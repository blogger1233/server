// validate.js
const validate = (req, file, cb) => {
   if(file.fieldname=="thumbnail"){
    if(file.mimetype.split("/")[0]!="image"){
        cb("invalid file mimeType",false)
      }
   }
   if(file.fieldname=="video"){
      if(file.mimetype.split("/")[0]!="video"){
        cb("invalid file mimeType",false)
      }
   }

   cb(null,true)
  };

  module.exports = validate;
