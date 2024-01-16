const nodemailer = require("nodemailer")

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: "4444dhruv@gmail.com",
      pass: "obaznwwhlnufuier",
    },
  });

async function sendMail(email,verificationCode){
    try{
        const info = await transporter.sendMail({
            from:"4444dhruv@gmail.com",
            to:email,
            subject:"Verfication code for new registration",
            html:`<!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta http-equiv="X-UA-Compatible" content="IE=edge">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
              <style>
                body {
                  font-family: 'Poppins', sans-serif;
                  margin: 0;
                  padding: 0;
                  background-color: #f4f4f4;
                }

                .container {
                  max-width: 600px;
                  margin: 20px auto;
                  padding: 20px;
                  background-color: #ffffff;
                  border-radius: 8px;
                  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                }

                h2 {
                  color: #333333;
                }

                p {
                  color: #555555;
                  font-size: 16px;
                  line-height: 1.6;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h2>Email Verification</h2>
                <p>Your verification code is: <strong>${verificationCode}</strong></p>
                <p>Please use this code to verify your email address.</p>
              </div>
            </body>
            </html>
            `
        })
        return info
    }
    catch(error){
        console.log(error)
        return null
    }
}

module.exports = sendMail;