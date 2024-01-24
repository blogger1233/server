const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors")
const app = express(); // <-- Add this line
app.use(cors())
app.use(express.json());
app.use(express.static("web"));
app.use("/static", express.static(path.join(__dirname,"./1aa7953a-624f-4eed-ac7b-97e48b5e582c")));

app.listen(4000, function () {
  console.log("Server is running at http://localhost:4000");
});
