const express = require("express");
const cors = require("cors");
const app = express.Router();

const { OAuth2Client } = require("google-auth-library");
const fetch = require("node-fetch");
const router = require("./userRegistration");
const dotenv  = require("dotenv")
dotenv.config();

const oauth2Client = new OAuth2Client(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  "http://localhost:8000/callback"
);

const scopes = ['https://www.googleapis.com/auth/userinfo.profile'];

// GET request for initiating the OAuth2 authorization flow
app.get("/", (req, res) => {
  const redirectUri = `${req.protocol}://${req.get("host")}/callback`;
  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    include_granted_scopes: true,
    prompt: "consent",
    redirect_uri: redirectUri,
  });
  res.json({ url: authorizationUrl });
});

// GET request handling the callback from Google after user grants authorization
app.get("/callback", async (req, res) => {
  const code = req.query.code;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    const accessToken = tokens.access_token;
    const idToken = tokens.id_token;

    // Use the access token to fetch user information
    const userInfo = await getUserInfo(accessToken);

    // Log the obtained tokens and user information
    console.log("Access Token:", accessToken);
    console.log("ID Token:", idToken);
    console.log("User Info:", userInfo);

    res.status(200).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Authorization Successful</title>
    </head>
    <body>
        <h1>Authorization Successful</h1>
        <p>Success: true</p>
        <p>User Info:</p>
        <ul>
            <li>Sub: ${userInfo.sub}</li>
            <li>Name: ${userInfo.name}</li>
            <li>Given Name: ${userInfo.given_name}</li>
            <li>Family Name: ${userInfo.family_name}</li>
            <li>Locale: ${userInfo.locale}</li>
        </ul>
        <img src="${userInfo.picture}" alt="User Image">
        <p>Token: ${accessToken}</p>
        <p>Message: Authorization successful</p>
    </body>
    </html>
`);
  } catch (error) {
    console.error("Error during token exchange:", error.message);
    console.error("Error details:", error);
    res.status(500).json({ success: false, message: "Error during token exchange" });
  }
});

async function getUserInfo(accessToken) {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user information: ${response.statusText}`);
  }

  return response.json();
}


module.exports = app;
