const express = require("express")
const jwt = require("jsonwebtoken")
const fs = require("fs");
const path = require("path");
const conn = require("../database/connect");

const router = express.Router();
async function resource(req, res, next) {
  try {

    if (req.params.email) {
      if (req.headers.authorization) {
        const token = req.headers.authorization.split(" ")[1]
        if (token) {
          const { client, database } = await conn("streaming_application")
          const collection = database.collection("tokens");
          const result = await collection.findOne({ email: req.params.email, token: token })
          if (result) {
            const filePath = path.resolve(__dirname, "../database/private_key.pem")
            fs.readFile(filePath, 'utf-8', function (error, data) {
              if (error) {
                res.status(500).json(error)
              }
              else {
                jwt.verify(token, data, { algorithms: "RS256" }, async function (error, payload) {
                  if (error) {
                    if (error.name === "TokenExpiredError") {
                      const collection_1 = database.collection("tokens");
                      const response = await collection_1.deleteOne({ token: token, email: req.params.email });

                      if (response.acknowledged) {
                        res.status(401).json({ message: "token expired" });
                        return;
                      }
                      else {
                        res.status(500).json({ message: response.error })
                      }
                    } else {
                      res.status(401).json({ user: "unauth", error: error });
                    }
                  } else {
                    if (req.params.email === payload.email) {
                      next();
                    }
                  }
                });
              }
            })
          }
          else {
            res.status(401).json({ message: "unauthorized token not found" })
            return;
          }
        }
        else {
          res.status(401).json("unauthorized")
          return;
        }
      }
      else {
        res.status(401).json("invalid authorization")
        return;
      }
    }
    else {
      res.status(404).json({ message: "unauth" })
    }
  }
  catch (error) {
    res.json(error)
  }
}
router.get("/:email", resource, async function (req, res) {
  try {
    const { client, database } = await conn("streaming_application");
    const collection = database.collection("videos");
    const data = await collection.find().toArray();
    res.json(data)
  }
  catch (error) {
    res.json(500).status(error)
  }
})
const multer = require("multer");
const {v4:uuid}=require("uuid");
const busboy = require("busboy");
const storage = multer.diskStorage({
  destination: function(req,file,cb){
    cb(null,path.resolve(__dirname,"../database/videos"));
  },
  filename: function(req,file,cb){
    cb(null,uuid()+path.extname(file.originalname))
  }
})
const uploading = multer({
  storage:storage,
  limits:{
    fileSize:5*1000*1000//5mb
  },
  fileFilter:function(req,file,cb){
    if(file.mimetype.split("/")[0]!="image"){
      cb("invalid file format",false)
    }
    else{
      cb(null,true)
    }
  }
})
const upload =uploading.single("thumbnail")


router.post("/:email/video", function (req, res) {
  const email = req.params.email;

  var fileSize = 0;
  var fileLimit = 4 * 1000 * 1000 * 1000; // 3 GB limit

  const busboyInstance =  busboy({ headers: req.headers });

  busboyInstance.on("file", function (name,file,info) {
    const saveto = fs.createWriteStream(path.resolve(__dirname,"../database/videos",uuid()+path.extname(info.filename)))
    file.pipe(saveto)
    file.on("data", function (data) {
      fileSize += data.length;
      console.log(fileSize);


    });

    file.on("end", async function () {
      if (fileSize > fileLimit) {
        fs.unlinkSync(saveto)
        file.unpipe(busboyInstance)
        res.json({ message: "File size exceeds the limit (4 GB)" });

        return;
      }
      else{

        try{
          const {client,database}= await conn("streaming_application")
          const collection = database.collection("video");
          const response  = await collection.insertOne({email:req.params.email,videoLocation:saveto})
          if(response.acknowledged){
            res.status(200).json({message:"file uploaded succesfully",insertId:response.insertedId})
            return;
          }
          else{
            res.status(400).json({message:"try again"})
            return;
          }
        }
        catch(error){
          res.json(error)
        }
      }
    });
  });
  req.pipe(busboyInstance);
});

module.exports = router;
