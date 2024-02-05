const {MongoClient}=require("mongodb")
const url= "mongodb://localhost:27017"
const client= new MongoClient(url)

const conn = async function(database_name){
    try{
        await client.connect();
        const database = client.db(database_name);
        return {client,database}
    }
    catch(error){
        return null;
    }
}


module.exports = conn

/*
    user info:
        email:
        username
        password:
        verified:
        pfp:
        chName:
        no_of_sub:  array(user_id)
        sub_channel: array(user_id)
        watchLater:array(videoId)
        likedVideo:array(videoId)


    video info:
        filename:
        email:
        video_dir:
        views:array(user_id)
        likeBy:
        dislikeBy:
        tags:
        description:
        thumbnail:
        title:


*/