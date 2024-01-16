const {MongoClient}=require("mongodb")
const url= "mongodb://localhost:27017"
const client= new MongoClient(url)

const conn = async function(database_name){
    try{
        await client.connect();
        const database = client.db(database_name);
        console.log("connected to the database");

        return {client,database}
    }
    catch(error){
        console.log("error while connecting to the database")
        return null;
    }
}


module.exports = conn