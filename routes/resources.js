const express = require("express")
const jwt = require("jsonwebtoken")
const fs = require("fs");
const path = require("path");
const conn = require("../database/connect");

const router = express.Router();
async function resource(req,res,next){
  try{

    if(req.params.email){
        if(req.headers.authorization){
            const token = req.headers.authorization.split(" ")[1]
            if(token){
                const {client,database}= await conn("streaming_application")
                const collection = database.collection("tokens");
                const result = await collection.findOne({email:req.params.email,token:token})
                if(result){
                    const filePath = path.resolve(__dirname,"../database/private_key.pem")
                    fs.readFile(filePath,'utf-8',function(error,data){
                        if(error){
                            res.status(500).json(error)
                        }
                        else{
                            jwt.verify(token, data, { algorithms: "RS256" }, async function (error, payload) {
                                if (error) {
                                  if (error.name === "TokenExpiredError") {
                                    const collection_1 = database.collection("tokens");
                                    const response = await collection_1.deleteOne({ token: token, email: req.params.email });

                                    if (response.acknowledged) {
                                      res.status(401).json({ message: "token expired" });
                                      return;
                                    }
                                    else{
                                        res.status(500).json({message:response.error})
                                    }
                                  } else {
                                    res.status(401).json({ user: "unauth", error: error });
                                  }
                                } else {
                                  if(req.params.email===payload.email){
                                    next();
                                  }
                                }
                              });
                        }
                    })
                }
                else{
                    res.status(401).json({message:"unauthorized token not found"})
                    return;
                }
            }
            else{
                res.status(401).json("unauthorized")
                return;
            }
       }
       else{
        res.status(401).json("invalid authorization")
        return;
       }
    }
    else{
        res.status(404).json({message:"unauth"})
    }
  }
  catch(error){
    res.json(error)
  }
}
router.get("/:email",resource,async function(req,res){
    try{
        const {client,database}= await conn("streaming_application");
        const collection = database.collection("videos");
        const data = await collection.find().toArray();
        res.json(data)
    }
    catch(error){
        res.json(500).status(error)
    }
})

const multer  = require("multer");
const { v4: uuid } = require("uuid");


const validate = require("./validate");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.resolve(__dirname, "../database/videos"));
  },
  filename: function (req, file, cb) {
    const getName = function () {
      const filename = uuid();
      return filename;
    }
    let filename = getName();
    cb(null, filename + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: validate,
  limits: {
    fileSize: 3 * 1024 * 1024 * 1024
  }
});

const file = upload.single('filename');

router.post("/:email",resource, async function (req, res) {
  try {
    file(req, res, function (error) {
      if (error) {
        console.log(error);
        res.status(400).send("File upload failed: " + error.message);
      } else {
        console.log(req.file);
        res.status(200).send("File uploaded successfully!");
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;


