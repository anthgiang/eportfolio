const Users = require("../models/users");

const getBio = async (req, res) => {
    const user = await Users.findOne({ username: req.params.username});

    if (user) {  //Username found
        res.send(user.bio);
    } else {
        res.status(404).json({msg: 'Could not find username in database.'});
    }
}

const updateBio = async (req, res) => {
    //from the auth middleware, having jwt in header returns username

    //get user information from the username
    var user = await Users.findOne({ username: req.user.username})
    if (!user) {
        return res.status(404).json({msg: 'Could not find username in the database.'});
    }

    if (req.body.text) {
        user.bio.text = req.body.text;
    } 

    if (req.body.socials) {
        // remove duplicate links
        user.bio.socials = req.body.socials.filter( (elem, pos) => {
            return req.body.socials.indexOf(elem) == pos;
        })
    }

    if (req.body.category) {
        user.bio.category = req.body.category;
    }

    user.save()
    .then(() => {
        return res.status(200).json({msg: 'Bio updated successfully.'})
    })
    .catch(() => {
        // doesn't update the document, returns error
        return res.status(400).json({msg: 'Invalid value for category enum, bio not updated.'})
    })
}

const updateName = async (req, res) => {
    //from the auth middleware, having jwt in header returns username

    //get user information from the username
    const user = await Users.findOne({ username: req.user.username});
    if (!user) {
        return res.status(404).json({msg: 'Could not find username in the database.'});
    }

    if (req.body.firstname === undefined) {
        return res.status(400).json({msg: 'Failed. Firstname is undefined.'}); 
    } else if (req.body.lastname === undefined) {
        return res.status(400).json({msg: 'Failed. Lastname is undefined.'}); 
    } else if (req.body.firstname.length === 0) {
        return res.status(400).json({msg: 'Failed. Firstname is an empty string.'}); 
    } else if (req.body.lastname.length === 0) {
        return res.status(400).json({msg: 'Failed. Lastname is an empty string.'});
    }

    user.firstname = req.body.firstname;
    user.lastname = req.body.lastname;
    user.save();
    return res.status(200).json({msg: 'Firstname and lastname updated successfully.'});
}


module.exports = {
    getBio,
    updateBio,
    updateName
}