function ValidateRegister(req)
{
  let errorMsg = {};

  if( typeof(req.body.email) == 'undefined' || typeof(req.body.password) == 'undefined')
  {
    errorMsg.email = req.t("enter_email_password_to_register");
    errorMsg.password = req.t("enter_email_password_to_register");
    return errorMsg;
  }

  const emailPattern = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;

  if(!emailPattern.test(req.body.email))
  {
    errorMsg.email = req.t("wrong_email_format");
  }

  if(req.body.password.length < 6)
  {
    errorMsg.password = req.t("wrong_password_length")
  }

  const alphaRegex = /[a-zA-Z]/;
  const numericRegex = /[0-9]/;

  if(!alphaRegex.test(req.body.password) || !numericRegex.test(req.body.password))
  {
    errorMsg.password = req.t("wrong_password_format")
  }

  if( typeof(req.body.username) == 'undefined')
  {
    errorMsg.username = req.t("nickname_not_exist")
  }

  const response = {
    status : false,
    data: errorMsg,
    message: "Error"
  };

  return errorMsg;
}

module.exports = {
  ValidateRegister
};