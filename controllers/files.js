const aws = require("../models/aws");
const Users = require("../models/users");

/*
 * Upload the url for the uploaded file to MongoDB.
 * called via the upload route. First the projectVerifyExists middleware verifies that our target
 * project exists, so we know that we'll be able to find it. Then multer uploads to aws S3. This
 * then uploads the resultant link stored in req.file.location to mongo.
 */
const uploadFile = async (req, res) => {
    var username = req.user.username;
    var projectname = req.params.projectid;
    var url = req.file.location;

    // upload to Mongo
    var query = { username: username };
    var updateDocument = {
        $addToSet: {"projects.$[project].attachments": {url: url}}      // addToSet means that a url will be unique
    };
    // choose only the array matching the desired project
    var options = {
        arrayFilters: [{
            "project.title" : projectname
        }]
    }

    Users.collection.updateOne(query, updateDocument, options)
    .then( (user) => {
        if (user){
            return res.status(201).send(url);
        } else {
            // Somehow the user/project got deleted, shouldn't happen. I guess we don't delete from aws here
            return res.status(500).json({msg:"Could not insert url into database."});
        }
    })
    .catch( (err) => {return res.status(500).json({msg:"Could not insert url into database."});});
   
};


/*
 * delete a file from the aws servers, then remove it from the mongo db database
 * 
 * File comes in the form of its url as stored in mongo
 */
const deleteFile = async (req, res) => {
    var username = req.user.username;   // from jwt
    var fileurl = req.body.fileurl;
    var title = req.params.projectid;

    // should we check that the file exists for the user?
    // I think we can get away with not doing it, because aws will just throw and error instead
    aws.deleteFile(fileurl, (err) => {
        if (err) {
            res.status(500).json({msg: "error deleting file"});
        } else {
            // file successfully deleted, remove the link from mongoDB
            Users.findOne({"username": username, "projects.title": { "$in": [title]} })
            .then( (search) => {
                if (search) {     // remove it
                    // find the project with the title, and remove the url from the list
                    for (var p of search.projects) {
                        if (p.title === title) {
                            p.attachments = p.attachments.filter( el => el.url !== fileurl);
                        }
                    }

                    search.save()
                    res.status(200).json({msg:"Successfully deleted file"});
            
                } else {
                    // file was deleted from aws but not mongo, without transactions there's not much we can do about this
                    return res.status(404).json({msg:"Could not find specified project-id for user."});
                }
            })
            .catch( (search) => res.status(404).json({msg:"Could not find specified project-id for user."}));
        }
    })
};


/* this is a function called by the backend by the projects.deleteProject route.
 * The user is assumed to have already been verified by the JWT.
 * callback conatins an error from AWS, or null
 */
const deleteProjectFiles = async (username, projecttitle, callback) => {
    var error = null;   // lets us send error to callback only once
    const search = await Users.findOne({"username": username, "projects.title": { "$in": [projecttitle]} })
    if (search) {
        // find the relevant project
        for (var p of search.projects) {
            if (p.title === projecttitle) {

                // delete all attachments in the folder from aws
                if (p.attachments) {
                    for (var u of p.attachments) {

                        aws.deleteFile(u.url, (err) => {
                            if (err) {
                                error = err;
                            }
                        })
                        if (error) break;
                    }
                    // no error if there were no attachments
                }
            }
        }
    } else {
        error = {msg:"Could not find specified project-id for user."};
    }
    callback(error);
}


/* upload new / update user's DP */
const uploadDP = (req, res) => {
    if (req.file === undefined) return res.status(400).json({msg:"No file provided."})
    
    var url = req.file.location;

    Users.findOne({username: req.user.username})
        .then( (user) => {
            user.picture = url;
            user.save()
            return res.status(201).send(url)
        })
        .catch( () => {
            res.status(500).json({msg: "server error"}) 
        });
}


/* delete a user's DP 
 * does not access mongoDB
 * callback has one argument and sends in the form err = {status:int, msg:string}}
 */
const deleteDP = (url, callback) => {

    // ensure the file exists first
    if (!url) {
        callback({status: 400, msg: "user does not have a dp."})
        return
    }

    aws.deleteFile(url, (err) => {
        if (err) {
            callback({status:500, msg:err.err});
            return
        }
        callback(null);
        return
    })
}


/* route to delete a user's dp
 * looks up the user based on req.user.username
 * sets the user's picture to null
 */
const deleteDPRoute = (req, res) => {
    Users.findOne({username: req.user.username})
    .then( (user) => {
        deleteDP(user.picture, (err) => {
            if (err) {
                return res.status(err.status).json({msg:err.msg});
            }
            user.picture = null;
            user.save();
            return res.status(200).json({msg:"successfully deleted dp."});
        })
    })
    .catch( () => {
        res.status(500).json({msg:"server error"})
    })
}



/*
 * @deprecated
 * upload a file to the aws servers, then add it to the mongo db database
 * Takes in a filename in req.body.filename and opens up the file from local storage
 */
const uploadFileFromLocal = async (req, res) => {
    var username = req.user.username;   // from jwt
    var filename = req.body.file;
    var projectname = req.params.projectid;

    // first, check if the project exists
    Users.collection.findOne({username: username, "projects.title": { "$in": [projectname]} })
    .then( async (project) => {
        if (project) {
            aws.uploadFileLocal(filename, username, projectname, async (err, url) => {
                if (err) { throw err; }
        
                // upload to Mongo
                var query = { username: username };
                var updateDocument = {
                    $addToSet: {"projects.$[project].attachments": {url: url}}      // addToSet means that a url will be unique
                };
                // choose only the array matching the desired project
                var options = {
                    arrayFilters: [{
                        "project.title" : projectname
                    }]
                }
        
                const user = await Users.collection.updateOne(query, updateDocument, options);
                if (user == null){
                    return res.status(500).json({msg:"Could not insert url into database."});
                } else {
                    return res.status(201).send(url);   // on success, send the url uploaded to
                }
            })
    } else {
        return res.status(404).json({msg:"Could not find specified project-id for user."});
    }})
    .catch(project => { return res.status(404).json({msg:"Could not find specified project-id for user."}); })
};


module.exports = {
    uploadFile,
    deleteFile,
    deleteProjectFiles,
    uploadDP,
    deleteDP,
    deleteDPRoute,
    uploadFileFromLocal,
}