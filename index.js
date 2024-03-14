const express = require("express");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const cors = require('cors')
const app = express();
const crypto = require("crypto");
require('dotenv').config();
const PORT = process.env.PORT || 8081;
const validator = require('./validator');

const i18next = require('i18next');
const Backend = require('i18next-node-fs-backend');
const i18nextMiddleware = require('i18next-http-middleware');

const config = {
  connectionString:
    process.env.DB
};

const { Client } = require('pg');
const { constants } = require("buffer");
const { parse } = require("path");
const { stringify } = require("querystring");
const { error } = require("console");
const client = new Client(config);
client.connect();

var corsOptions = { origin: "*" }
if(process.env.APP_ENV === "production"){
  var whitelist = process.env.WHITELIST_URLS.split(',');
  corsOptions = {
    origin: function (origin, callback) {
      if (whitelist.indexOf(origin) !== -1 || !origin) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    }
  }
}

i18next
  .use(Backend)
  .use(i18nextMiddleware.LanguageDetector)
  .init({
      backend: {
          loadPath: __dirname + '/locales/{{lng}}/{{ns}}.json'
      },
      fallbackLng: 'en',
      preload: ['en', 'zh']
});

app.use(cors(corsOptions))
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false, parameterLimit:50000 }));
app.use(i18nextMiddleware.handle(i18next));

app.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});

function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (authHeader)
  {
    const token = authHeader.split(" ")[1];

    jwt.verify(token, process.env.TOKEN_KEY, async (err, user) =>
    {
      if (err)
      {
        return res.sendStatus(401);
      }
      if(user?.role == 99)
      {
        let result = await client.query("SELECT * FROM users WHERE token = $1", [token])
        if(result.rows.length <= 0)
        {
          const response = {
            status : false,
            data: {},
            message: req.t("session_expired")
          };

          return res.status(401).json(response);
        }
      }

      req.user = user;
      next();
    });
  }
  else
  {
    return res.sendStatus(401);
  }
}

function GenerateJWT(_userId, _username)
{
  return jwt.sign(
      { userId: _userId, username: _username},
      process.env.TOKEN_KEY,
      { expiresIn: "2h" }
    );
}

//#region Route
app.get('/', async (req, res) => {
  res.status(200).send("OK");
})

app.post('/login', async (req, res) => {
  if( typeof(req.body.email) == 'undefined' || typeof(req.body.password) == 'undefined')
  {
    const response = {
      status : false,
      data: {
        email: req.t("enter_email_password_to_login"),
        password: req.t("enter_email_password_to_login"),
      },
      message: "Error"
    };

    return res.status(200).json(response);
  }

  client.query("SELECT * FROM users WHERE email = $1 AND password = crypt($2, password)", [req.body.email, req.body.password])
  .then((result) => {
    if(result.rows.length > 0)
    {
      const token = GenerateJWT(result.rows[0].id, result.rows[0].username);

      client.query("UPDATE users SET last_login = NOW(), token = $1 WHERE id = $2", [token, result.rows[0].id])

      res.status(200).json({
        status: true,
        data: {
          userId: result.rows[0].id,
          token: token,
        },
        message: ""
      }); 
    }
    else
    {
      const response = {
        status : false,
        data: {
          password: req.t("incorrect_email_password")
        },
        message: "Error"
      };
  
      return res.status(200).json(response);
    }
  })
  .catch((e) => {
    console.error(e.stack);
    res.status(500).send(e.stack);
  });
});

app.post('/register', async (req, res) => { //register

  const errorMsg = validator.ValidateRegister(req);

  if(Object.keys(errorMsg).length > 0)
  {
    const response = {
      status : false,
      data: errorMsg,
      message: "Error"
    };

    return res.status(200).json(response);
  }

  client.query("SELECT * FROM users WHERE email = $1", [req.body.email])
  .then(async (result) => {
    if(result.rows.length > 0)
    {
      if(req.body.email == result.rows[0].email)
      {
        const response = {
          status : false,
          data: {
            email : req.t("email_taken")
          },
          message: "Error"
        };

        return res.status(200).json(response);
      }
    }
    else
    {
      let query = `INSERT INTO users (email, password, username) VALUES ($1, crypt($2, gen_salt('bf')), $3)`;

      let params = [
        req.body.email,
        req.body.password,
        req.body.username,
      ];
      
      client.query(query, params)
      .then((newUser) => {
        res.status(200).json(newUser);
        const response = {
          status : true,
          data: {
            userId : newUser.rows[0].id,
            email : newUser.rows[0].email,
            username : newUser.rows[0].username
          },
          message: req.t("register_success")
        };

        res.status(200).json(response);
      })
      .catch((e) => {
        console.error(e.stack);
        res.status(500).send(e.stack);
      })
    }
  })
  .catch((e) => {
    console.error(e.stack);
    res.status(500).send(e.stack);
  });
});

app.get('/users', verifyToken, async (req, res) => { //get user info
  
  let query = `SELECT * FROM users WHERE id = $1`;

  let params = [
    req.user.userId
  ];

  client.query(query, params)
  .then((result) => {

    delete result.rows[0].password;

    res.json(result.rows[0]);
  })
  .catch((e) => {
    console.error(e.stack);
    res.status(500).send(e.stack);
  });
});

app.get('/farms', verifyToken, async (req, res) => { //get all farms info that belong to this user

  let query = `SELECT * FROM farms WHERE uid = $1`;
  let params = [req.user.userId];

  client.query(query, params)
  .then((farms) => {

    let ownedFarm = [];

    if(farms.rows.length > 0)
    {
      for(var i = 0; i < farms.rows.length; i++)
      {
        ownedFarm.push(farms.rows[i].id);
      }

      const response = {
        status : true,
        data: ownedFarm,
        message: "Success"
      };
  
      return res.status(200).json(response);
    }
    else
    {
      const response = {
        status : false,
        data: "",
        message: "Error: No farm found."
      };
  
      return res.status(200).json(response);
    }
    
  })
  .catch((e) => {
    console.error(e.stack);
    res.status(500).send(e.stack);
  });
});

app.get('/farm', verifyToken, async (req, res) => { //get specific farms info

  let query = `SELECT * FROM farms WHERE id = $1`;
  let params = [req.body.farmId];
  let plantSetting = await client.query("SELECT value FROM settings WHERE key = $1", ["plantSetting"]);
  
  client.query(query, params)
  .then((farm) => {

    let cropField = farm.rows[0].crop_field;

    cropField.forEach((field) => {
      field.forEach(async (plantId) => {
        
        let plant = await client.query("SELECT * FROM plants WHERE id = $1", [plantId]);
        const currentTimestamp = Date.now() / 1000;
        let requireGrowthTime = plantSetting.rows[0].value[0].growth_time;

        let updatedAt = plant.rows[0].updated_at;
        let elapsedTimeInMinute = (updatedAt - currentTimestamp) / 60;
        let remainingWaterPoint = parseInt(plant.rows[0].water_point);
        let growthPoint = 0;
        
        let diff = remainingWaterPoint - elapsedTimeInMinute;

        if(diff >= 0)
        {
          remainingWaterPoint -= elapsedTimeInMinute;
          growthPoint = elapsedTimeInMinute;
        }
        else
        {
          remainingWaterPoint = 0;
          growthPoint = remainingWaterPoint;
        }

        if(plant.rows[0].is_fertilized == 1)
          growthPoint += (parseInt(plant.rows[0].growth_point) * 2);
        else
          growthPoint += parseInt(plant.rows[0].growth_point);

        let growthStage = 0;

        if(growthPoint >= requireGrowthTime)
          growthStage = 3;
        else if(growthPoint >= (requireGrowthTime / 3 * 2))
          growthStage = 3;
        else if(growthPoint >= (requireGrowthTime / 3))
          growthStage = 1;

        await client.query(
          "UPDATE plants SET growth_stage = $1, growth_point = $2, water_point = $3, updated_at = NOW() WHERE id = $4",
          [growthStage, growthPoint, remainingWaterPoint, plantId]);
      });
    });
  })
  .catch((e) => {
    console.error(e.stack);
    res.status(500).send(e.stack);
  });
});

app.post('/farm', verifyToken, async (req, res) => { //update farm, not working yet
  
  if (req.body.hasOwnProperty('farmId') && typeof(req.body.farmId) == 'undefined') {
    errorMsg.farmId = req.t("farm_not_exist");
  }

  if (req.body.hasOwnProperty('cropField') && typeof(req.body.cropField) == 'undefined') {
    errorMsg.cropField = req.t("farm_not_exist");
  }

  const errorMsg = {};

  if(Object.keys(errorMsg).length > 0)
  {
    const response = {
      status : false,
      data: errorMsg,
      message: "Error"
    };

    return res.status(200).json(response);
  }

  let query = `UPDATE farm SET crop_field = $1 WHERE id = $2 RETURNING *`;
  let params = [req.body.cropField, req.user.farmId];

  client.query(query, params)
  .then((result) => {
    const response = {
      status : true,
      data: {
        farmId : result.rows[0].id,
        cropData : result.rows[0].cropData
      },
      message: req.t("update_success")
    };

    res.status(200).json(response);
  })
  .catch((e) => {
    console.error(e.stack);
    res.status(500).send(e.stack);
  });
});

app.get('/plants', verifyToken, async (req, res) => { //get plant info
  
  const errorMsg = {};

  if (req.body.hasOwnProperty('plantId') && typeof(req.body.plantId) == 'undefined') {
    errorMsg.farmId = req.t("plant_not_exist");
  }

  if(Object.keys(errorMsg).length > 0)
  {
    const response = {
      status : false,
      data: errorMsg,
      message: "Error"
    };

    return res.status(200).json(response);
  }

  let query = `SELECT * FROM plants WHERE id = $1`;
  let params = [req.body.plantId];

  client.query(query, params)
  .then((result) => {

    const response = {
      status : true,
      data: result.rows[0],
      message: ""
    };

    res.status(200).json(response);
  })
  .catch((e) => {
    console.error(e.stack);
    res.status(500).send(e.stack);
  });
});

app.post('/plants/watering', verifyToken, async (req, res) => { //watering plant
  
  const errorMsg = {};

  if (req.body.hasOwnProperty('plantId') && typeof(req.body.plantId) == 'undefined') {
    errorMsg.farmId = req.t("plant_not_exist");
  }

  if(Object.keys(errorMsg).length > 0)
  {
    const response = {
      status : false,
      data: errorMsg,
      message: "Error"
    };

    return res.status(200).json(response);
  }

  //let user = await client.query("SELECT * FROM users where id = $1", [req.user.userId]);
  
  let query = `UPDATE plants SET water_point = water_point + $1 WHERE id = $2`;
  let params = [5, req.body.plantId];
  //hardcode the value for now
  //in future will add in the facility/tools system to decide how much watering power they have

  client.query(query, params)
  .then((result) => {

    const response = {
      status : true,
      data: result.rows[0],
      message: ""
    };

    res.status(200).json(response);
  })
  .catch((e) => {
    console.error(e.stack);
    res.status(500).send(e.stack);
  });
});

app.post('/plants/fertilize', verifyToken, async (req, res) => { //fertilize plant
  
  const errorMsg = {};

  if (req.body.hasOwnProperty('plantId') && typeof(req.body.plantId) == 'undefined') {
    errorMsg.farmId = req.t("plant_not_exist");
  }

  if(Object.keys(errorMsg).length > 0)
  {
    const response = {
      status : false,
      data: errorMsg,
      message: "Error"
    };

    return res.status(200).json(response);
  }

  let query = `UPDATE plants SET is_fertilized = TRUE WHERE id = $1`;
  let params = [req.body.plantId];

  client.query(query, params)
  .then((result) => {

    const response = {
      status : true,
      data: result.rows[0],
      message: ""
    };

    res.status(200).json(response);
  })
  .catch((e) => {
    console.error(e.stack);
    res.status(500).send(e.stack);
  });
});

app.post('/plants/pruning', verifyToken, async (req, res) => { //pruning plant, do nothing for now
  
  // const errorMsg = {};

  // if (req.body.hasOwnProperty('plantId') && typeof(req.body.plantId) == 'undefined') {
  //   errorMsg.farmId = req.t("plant_not_exist");
  // }

  // if(Object.keys(errorMsg).length > 0)
  // {
  //   const response = {
  //     status : false,
  //     data: errorMsg,
  //     message: "Error"
  //   };

  //   return res.status(200).json(response);
  // }

  // let query = `SELECT * FROM plants WHERE id = $1`;
  // let params = [req.body.plantId];

  // client.query(query, params)
  // .then((result) => {

  //   const response = {
  //     status : true,
  //     data: result.rows[0],
  //     message: ""
  //   };

  //   res.status(200).json(response);
  // })
  // .catch((e) => {
  //   console.error(e.stack);
  //   res.status(500).send(e.stack);
  // });
});

app.post('/plants/havest', verifyToken, async (req, res) => { //havest plant
  
  const errorMsg = {};

  if (req.body.hasOwnProperty('plantId') && typeof(req.body.plantId) == 'undefined') {
    errorMsg.farmId = req.t("plant_not_exist");
  }

  if(Object.keys(errorMsg).length > 0)
  {
    const response = {
      status : false,
      data: errorMsg,
      message: "Error"
    };

    return res.status(200).json(response);
  }

  let query = `SELECT * FROM plants WHERE id = $1`;
  let params = [req.body.plantId];

  client.query(query, params)
  .then((plant) => {

    if(plant.rows[0].growth_stage == 3 && plant.rows[0].harvested_at == null)
    {
      client.query("UPDATE plants SET harvested_at = NOW() WHERE id = $1", [plant.rows[0].id]);
      client.query("INSERT INTO inventory (uid, type) VALUES ($1, $2)", [req.user.userId, plant.rows[0].type]);

      const response = {
        status : true,
        data: plant.rows[0],
        message: ""
      };
  
      res.status(200).json(response);
    }
  })
  .catch((e) => {
    console.error(e.stack);
    res.status(500).send(e.stack);
  });
});

app.get('/inventory', verifyToken, async (req, res) => { //get inventory
  
  let query = `SELECT * FROM inventory WHERE uid = $1 AND status = 0`;
  let params = [req.user.userId];

  client.query(query, params)
  .then((result) => {

    const response = {
      status : true,
      data: result.rows[0],
      message: ""
    };

    return res.status(200).json(response);
  })
  .catch((e) => {
    console.error(e.stack);
    res.status(500).send(e.stack);
  });
});

app.post('/buySeed', verifyToken, async (req, res) => { //buy seed

  if (req.body.hasOwnProperty('plantId') && typeof(req.body.plantId) == 'undefined') {
    
    const response = {
      status : false,
      data: "",
      message: req.t("plant_not_exist")
    };

    return res.status(200).json(response);
  }

  let plantSetting = await client.query("SELECT value FROM settings WHERE key = $1", ["plantSetting"]);
  let user = await client.query("SELECT * FROM users WHERE id = $1", [req.user.userId]);
  
  if(parseFloat(user.rows[0].balance) <= parseFloat(plantSetting.rows[0].value[plantId].cost))
  {
    const response = {
      status : false,
      data: "",
      message: req.t("insufficient_credit")
    };

    return res.status(200).json(response);
  }

  let query = "UPDATE users SET balance = balance - $1 WHERE id = $2";
  let params = [parseFloat(plantSetting.rows[0].value[plantId].cost), req.user.userId];

  client.query(query, params)
  .then(async (result) => {
    
    await client.query("INSERT INTO inventory (uid, type, plant_id) VALUES ($1, $2, $3)", [req.user.userId, 0, plantId]);
    const response = {
      status : true,
      data: "",
      message: req.t("update_success")
    };

    res.status(200).json(response);
  })
  .catch((e) => {
    console.error(e.stack);
    res.status(500).send(e.stack);
  });
});

app.post('/sellFruit', verifyToken, async (req, res) => { //sell fruit

  if (req.body.hasOwnProperty('plantId') && typeof(req.body.plantId) == 'undefined') {
    
    const response = {
      status : false,
      data: "",
      message: req.t("plant_not_exist")
    };

    return res.status(200).json(response);
  }

  if ((req.body.hasOwnProperty('quantity') && typeof(req.body.quantity) == 'undefined'))
  {
    const response = {
      status : false,
      data: "",
      message: req.t("quantity_not_exist")
    };

    return res.status(200).json(response);
  }
  
  if (parseInt(req.body.quantity) <= 0)
  {
    const response = {
      status : false,
      data: "",
      message: req.t("quantity_bigger_than_zero")
    };

    return res.status(200).json(response);
  }

  let plantSetting = await client.query("SELECT value FROM settings WHERE key = $1", ["plantSetting"]);
  let inventory = await client.query("SELECT * FROM inventory WHERE uid = $1 AND plant_id = $2 AND type = 1 AND status = 0", [req.user.userId, req.body.plantId]);
  
  if(inventory.rows.length > parseInt(req.body.quantity))
  {
    let query = "INSERT into market (uid, plant_id, quantity, datetime, offer_price) VALUES ($1, $2, $3, NOW(), $4)";
    let params = [req.user.userId, req.body.plantId, req.body.quantity, parseFloat(plantSetting.rows[0].value[req.body.plantId].sell_price)]

    client.query(query, params)
    .then(async () => {

      const response = {
        status : true,
        data: "",
        message: req.t("update_success")
      };
  
      return res.status(200).json(response);

    })
    .catch((e) => {
      console.error(e.stack);
      res.status(500).send(e.stack);
    });
  }
  else
  {
    const response = {
      status : false,
      data: "",
      message: req.t("plant_not_exist")
    };

    return res.status(200).json(response);
  }
});

//#endregion