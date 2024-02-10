const express = require("express")
const jwt = require("jsonwebtoken")
const fs = require("fs");
const path = require("path");
const conn = require("../database/connect");
const ffmpeg = require("fluent-ffmpeg")
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
          res.status(401).json({message:"unauthorized"})
          return;
        }
      }
      else {
        res.status(401).json({message:"invalid authorization"})
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
    const collection = database.collection("video");
    const data = await collection.find().toArray();
    res.json(data)
  }
  catch (error) {
    res.json(500).status(error)
  }
})
const multer = require("multer");
const { v4: uuid } = require("uuid");
const busboy = require("busboy");
const { ObjectId } = require("mongodb");


router.post("/:email/video",resource, (req, res) => {
  ffmpeg.setFfmpegPath(path.resolve(__dirname,"../ffmpeg"))
  ffmpeg.setFfprobePath(path.resolve(__dirname,"../ffmpeg.ffprobe"))
  const directoryName = uuid();
  const email = req.params.email;
  const directoryPath = path.resolve(__dirname, "../database/videos", email, directoryName);
  try {
    fs.mkdirSync(path.resolve(__dirname, "../database/videos", email), { recursive: true });
    fs.mkdir(directoryPath, (err) => {
      if (err) {
        fs.rmdirSync(directoryPath)
        res.status(500).json({ message: "Error creating directory", error: err });

      } else {
        const busboyInstance = busboy({ headers: req.headers });
        var fileSize = 300*1000*1000;
        var chunkSize = 0;
        var flag = 1;
        var limit = 1;
        busboyInstance.on("file", function (name, file, info) {
          var filename = uuid() + path.extname(info.filename)
          var write = fs.createWriteStream(path.resolve(directoryPath, filename));
          file.pipe(write)
          file.on("data", function (data) {

            chunkSize += data.length;
            console.log(chunkSize)
            if (chunkSize > fileSize) {
              limit = 0;
            }
          })

          file.on("end", function () {
            if(chunkSize==0)
            {
              fs.rmdirSync(directoryPath,{recursive:true})
              res.json({message:'invalid file'})
              return;
            }
            if (info.mimeType.split("/")[0] != "video") {

              fs.rmdir(directoryPath,{recursive:true}, function (err) {
                if (err) {
                  res.json({ message: err })
                  return;
                }
                else {

                  res.json({ message: "video format file required" })

                  return;
                }
              })

            }

            if (limit==0) {
              fs.rmdir(directoryPath,{recursive:true}, (err) => {
                if (err) {
                  res.status(200).json({ message: err })
                  return;
                }
                else {
                  res.status(200).json({ message: "file exceeded the limit", dir: directoryPath })
                  return;
                }
              })
            }





             if (flag!=0 && limit!=0) {
              console.log(info)


              write.on("finish", async () => {

                try {
                  const { client, database } = await conn("streaming_application");
                  const collection = database.collection("video");
                  const filename = path.basename(write.path).split(".")[0];

                  await new Promise((resolve, reject) => {
                    ffmpeg(write.path)
                      .ffprobe(async (err, data) => {
                        if (err) {
                          fs.rmdir(directoryPath, { recursive: true }, (err) => {
                            if (err) {
                              res.json({ message: "try again", err: err });
                            } else {
                              res.json({ err: err });
                            }
                            reject(err);
                          });
                        } else {
                          const duration = data.format.duration;
                          const r = ['426x240','640x360','854x480','1280x720','1920x1080'];
                          var mainFileContent = `
              #EXTM3U
              #EXT-X-VERSION:3
              `;

                          const promises = r.map(async (value) => {
                            const outputPlaylist = path.resolve(directoryPath,`${filename}_${value}.m3u8`);

                            await new Promise((resolve, reject) => {
                              ffmpeg(write.path)
                                .outputOptions([
                                  '-profile:v baseline',
                                  '-level 3.0',
                                  `-s ${value}`,
                                  '-start_number 0',
                                  `-hls_time ${duration/10}`,
                                  '-hls_list_size 0',
                                  `-t ${duration}`,
                                ])
                                .output(outputPlaylist)
                                .on('end', () => {
                                  console.log(`Conversion for resolution ${value} finished.`);
                                  mainFileContent += `
              #EXT-X-STREAM-INF:BANDWIDTH=<your_bandwidth_value>, RESOLUTION=${value}, NAME="${value}"
              ${path.basename(outputPlaylist)}
              `;
                                  resolve();
                                })
                                .on('error', (err,std,str) => {
                                  console.error(`Error for resolution ${value}:`, err,std,str);
                                  reject(err);
                                })
                                .run();
                            });
                          });

                          await Promise.all(promises);

                          const mainPlaylistPath = path.resolve(directoryPath, `${filename}.m3u8`);
                          fs.writeFileSync(mainPlaylistPath, mainFileContent);

                          const response = await collection.insertOne({
                            email: req.params.email,
                            video_dir: directoryPath,
                            filename: filename,
                            views:[],
                            tags:[],
                            description:"",
                            thumbnail:"",
                            title:"",
                            dislikeBy:[],
                            likeBy:[],
                            upload_date:Date.now()
                          });

                          if (response.acknowledged) {
                            const user_info = database.collection("userinfo")
                            const response2 = await user_info.updateOne({email:req.params.email},{
                              $push:{yourVideo:response.insertedId}
                            })
                            res.json({ message: "processing finished file uploaded", insertId: response });
                          } else {
                            fs.rmdirSync(directoryPath, { recursive: true });
                            res.json({ message: 'try again' });
                          }

                          resolve();
                        }
                      });
                  });
                } catch (error) {
                  res.status(500).json({ message: "Error processing files", error: error });
                }
              });




              write.on("err", function (err) {
                res.json({ message: err })
                return;
              })


            }


          })



        })

        req.pipe(busboyInstance)

      }
    });
  } catch (error) {
    res.status(500).json({ message: "Error creating directory", error: error });
  }
});




const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.resolve(__dirname, "../database/videos/thumbnail"));
  },
  filename: function (req, file, cb) {
    cb(null, uuid() + path.extname(file.originalname));
  }
});

const uploading = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1000 * 1000, // 5mb
  },
  fileFilter: function (req, file, cb) {
    if (!req.body.heading) {
      cb("heading required", false);
    } else if (file.mimetype.split("/")[0] !== "image") {
      cb("invalid file format", false);
    } else {
      cb(null, true);
    }
  }
});

const upload = uploading.single("thumbnail");

router.post("/:email/details/:insertid", resource, async function (req, res) {
  try {

    const { client, database } = await conn("streaming_application");
    const collection = database.collection("video");
    const response = await collection.findOne({ _id: new ObjectId(req.params.insertid), email: req.params.email });
    if (response) {
      upload(req, res, async function (error) {
        if (error) {
          res.status(400).json({ message: error, mail: "4444dhruv@gmail.com" });
        } else {
          const response2 = await collection.updateOne(
            {
              email: req.params.email,
              _id: new ObjectId(req.params.insertid),
            },
            {
              $set: {
                thumbnail: req.file,
                title: req.body.heading,
                description:req.body.desc
              },
              $push:{
                tags:req.body.tags.split("#")
              }
            }
          );

          if (response2.acknowledged) {
            res.status(200).json(response2);
          } else {
            res.status(500).json({ message: "try again" });
          }
        }
      });
    } else {
      res.json("invalid video id");
    }
  } catch (error) {
    res.json(error);
  }
});
router.get("/:email/video/:no",resource,async function(req,res){
      try{
        const no = req.params.no;
        const {client,database}=await conn("streaming_application")
        const collection = database.collection("video")
        const result = await collection.find({}).skip(no*10).limit(10).toArray();

        res.json(result)
        return
      }
      catch{
        res.json({message:'error'})
        return;
      }
})

router.patch("/:email/video/:insertid/:like", resource, async function (req, res) {
  const email = req.params.email;
  const insertId = req.params.insertid;
  var like = true;

  if (req.params.like == "true") {
    like = true;
  }
  if (req.params.like == "false") {
    like = false;
  }

  try {
    const { client, database } = await conn("streaming_application");
    const collection = database.collection("video");
    const user_info = database.collection("userinfo");
    const response = await collection.findOne({ _id: new ObjectId(insertId) });

    if (response) {
      const likeBy = response.likeBy;
      const dislikeBy = response.dislikeBy;

      if (likeBy.includes(email)) {
        // User already liked the video


        if (like) {
          // User wants to unlike the video
          await collection.updateOne(
            { _id: new ObjectId(insertId) },
            { $pull: { likeBy: req.params.email } }
          );
          await user_info.updateOne(
            { email: req.params.email },
            { $pull: { likedVideo: new ObjectId(insertId) } }
          );
          res.json({message:"user has unliked the video"});
          return
        } else {
          // User already liked the video but wants to dislike
          await collection.updateOne(
            { _id: new ObjectId(insertId) },
            {
              $pull: { likeBy: req.params.email },
              $push: { dislikeBy: req.params.email },
            }
          );
          await user_info.updateOne(
            { email: req.params.email },
            { $pull: { likedVideo: new ObjectId(insertId) } }
          );
          res.json({message:"user has changed from liking to disliking the video"});
          return
        }
      } else if (dislikeBy.includes(email)) {
        // User already disliked the video


        if (like) {
          // User already disliked but wants to like
          await collection.updateOne(
            { _id: new ObjectId(insertId) },
            {
              $pull: { dislikeBy: req.params.email },
              $push: { likeBy: req.params.email },
            }
          );
          await user_info.updateOne(
            { email: req.params.email },
            { $pull: { likedVideo: new ObjectId(insertId) } }
          );
          res.json({message:"user has changed from disliking to liking the video"});
          return
        } else {
          // User wants to undislike the video
          await collection.updateOne(
            { _id: new ObjectId(insertId) },
            { $pull: { dislikeBy: req.params.email } }
          );
          res.json({message:"user has undisliked the video"});
          return
        }
      } else {

        if (like) {
          // User likes the video
          await collection.updateOne(
            { _id: new ObjectId(insertId) },
            { $push: { likeBy: req.params.email } }
          );
          await user_info.updateOne(
            { email: req.params.email },
            { $push: { likedVideo: new ObjectId(insertId) } }
          );
           res.json({message:"user liked the video"})
          return
        } else {
          // User dislikes the video
          await collection.updateOne(
            { _id: new ObjectId(insertId) },
            { $push: { dislikeBy: req.params.email } }
          );
          res.json({message:"user has disliked the video"});
          return
        }
      }
    } else {
      res.status(400).json({ message: "Video not found" });
      return
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
    return
  }
});


const multer2 = multer.diskStorage({
  destination: function(req,file,cb){
    cb(null,path.resolve(__dirname,"../database/videos/profile"))
  },
  filename:function(req,file,cb){
    const filename = uuid()+path.extname(file.originalname);
    cb(null,filename)
  },
  fileFilter:(req,file,cb)=>{
    if(file.mimeType.split("/")[0]!="image"){
      cb("invalid file type image required",false)
    }

    return cb(null,true)
  }
})

const uploadProfile = multer({storage:multer2})
var uploadPfp = uploadProfile.single("profile")
router.post("/:email/adduserDetails", resource, async function(req, res) {
  try {
    const { client, database } = await conn("streaming_application");
    const collection = database.collection("userinfo");
    const data = await collection.findOne({ email: req.params.email }, { projection: { pfp: 1, chName: 1 } });

    uploadPfp(req, res, async function(err) {
      if (err) {
        res.json({ message: err });
        return;
      } else {
        const path = req.file.path;
        const response = await collection.updateOne(
          { email: req.params.email },
          { $set: { pfp: path, chName: req.body.chName } }
        );

        if (response.acknowledged) {
          fs.access(data.pfp, fs.constants.F_OK, (err) => {
            if (err) {
              // File does not exist

              res.json({ message: "Profile details updated successfully" });
              return;
            } else {
              // File exists
              fs.unlinkSync(data.pfp);
              res.json({ message: "Profile details updated successfully" });
              return;
            }
          });
        }
      }
    });
  } catch (err) {
    res.json({ message: err });
    return;
  }
});







module.exports = router;
