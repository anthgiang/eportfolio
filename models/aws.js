require('dotenv').config();
const fs = require('fs');
const AWS = require('aws-sdk');

// update the AWS config
AWS.config = new AWS.Config();
AWS.config.accessKeyId = process.env.AWS_ACCESS_KEY;
AWS.config.secretAccessKey = process.env.AWS_SECRET_KEY;
AWS.config.region = 'ap-southeast-2';


// These next methods seem to be more 'modern' ways of setting the config but I can't get them to work

// const SESConfig = {
//     accessKeyId: process.env.AWS_ACCESS_KEY,
//     accessSecretKey: process.env.AWS_SECRET_KEY,
//     region: 'ap-southeast-2'
// }
// AWS.config.update(SESConfig);

// const s3 = new AWS.S3({
//     accessKeyID: process.env.AWS_ACCESS_KEY,
//     secretAccessKey: process.env.AWS_SECRET_KEY,
//     region: 'ap-southeast-2'
// });

const s3 = new AWS.S3();

/* 
    upload a file given by filename to AWS S3
    if foldername is not speicifed, uploads to the tests/ folder

    folder scheme follows "/username/projectname/file"

    returns the url the file was uploaded to, to be inserted into the mongo db

    callback has 2 arguments (err, url)
        - err is null or contains the AWS error message
        - url wil hold the URL that the file was uploaded to
*/
function uploadFile(filename, username, projectname, callback) {
    fs.readFile(filename, (err, data) => {
        if (err) {
            callback(err, undefined);
        }

        var fileKey = getFolderKey(username, projectname) + encodeURIComponent(filename);

        const params = {
            Bucket: process.env.AWS_BUCKET,
            Key: fileKey,
            Body: JSON.stringify(data, null, 2)
        };
        // s3.upload(params, function (s3Err, data) {
        //     if (s3Err) throw s3Err
        //     console.log(`File uploaded successfully at ${data.Location}`);
        // });

        var upload = new AWS.S3.ManagedUpload({params});

        var promise = upload.promise();

        promise.then(
            function (data) {
                // console.log(`Successfully uploaded file: ${data.Location}`);
                callback(null, getFileURL(fileKey));
            },
            function (err) {
                // console.log("Error uploading file: " + err.message);
                callback(err.message, undefined);
                return
            }
        );
    });
};


/*
    creates a folder on AWS S3
    This could either be used to create folders for individual users, or for 
    users to be able to create their own folders (or both)
*/
function createFolder(folderName) {
    folderName = folderName.trim();
    if (!folderName) {
        console.log("Folder names must contain at least one non-space character.");
        return
    }
    if (folderName.includes('/')) {
        console.log("Folder names cannot contain slashes.");
        return
    }

    // here we don't use getFolderKey as that adds a '/'
    var folderKey = encodeURIComponent(folderName);

    s3.headObject({ Key: folderKey, Bucket: process.env.AWS_BUCKET }, function (err, data) {
        if (!err) {
            console.log("Folder already exists.");
            return
        }
        if (err.code !== "NotFound") {
            console.log("There was an error creating folder: " + err.message);
            return
        }
        s3.putObject({ Key: folderKey, Bucket: process.env.AWS_BUCKET }, function (err, data) {
            if (err) {
                console.log("There was an error creating folder: " + err.message);
                return
            }
            console.log("Successfully created folder: " + folderKey);
        });
    });
}


/* 
    delete a file given by filename from AWS S3
    if foldername is not speicifed, deletes from the tests/ folder

    callback has 1 argument (err) that will contain the AWS error message
*/
function deleteFile(fileName, username, projectname, callback) {

    var fileKey = getFolderKey(folderName) + encodeURIComponent(fileName);

    s3.deleteObject({ Key: fileKey, Bucket: process.env.AWS_BUCKET }, function (err, data) {
        if (err) {
            callback(err.message);
            return
        }
        callback(null);
    });
}

/*
    convert a username and projectname into a valid string to act as a foldername, and adds a '/'
*/
function getFolderKey(username = undefined, projectname = undefined) {
    if (username === undefined || projectname === undefined) {
        var folderKey = "tests/";
    } else {
        var folderKey = encodeURIComponent(username) + "/" + encodeURIComponent(projectname) + "/";
    }
    return folderKey;
}

/*
    generate the url that a file will be saved to based on its fileKey
*/
function getFileURL(fileKey) {
    return "https://" + process.env.AWS_BUCKET + ".s3." + process.env.AWS_REGION + ".amazonaws.com/" + fileKey
}

module.exports = {
    uploadFile,
    deleteFile
}

// uploadFile("p.pdf", "greghouse", "tests", (err, data) => {console.log( data)});