var express = require('express');
var bodyParser = require('body-parser');
var nodemailer = require('nodemailer');
var redis = require('redis');
var redisClient = redis.createClient();
var async= require('async');
var app =  express();

smtpTransport   = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        "user": "dev.medibox@gmail.com",
        "pass": "me*******"
    }
})


var host = "localhost:5000";
app.use(bodyParser.urlencoded({"extended" : false}));

app.get('/',function(req,res){
    res.sendfile('index.html');
});

app.post('/send',function(req,res){
    console.log(req.body.to);
    async.waterfall([
        function(callback){
            redisClient.exists(req.body.to,function(err,reply){
                if(err){
                    return callback(true,"error in redis");
                }
               /* if(reply===1){
                    return callback(true,"email is already requested");
                }*/
                callback(null);
            })
        },

        function(callback){
            var rand = Math.floor((Math.random() * 100) + 54);
            var encodedMail = new Buffer(req.body.to).toString('base64');
            var link="http://"+req.get('host')+"/verify?mail="+encodedMail+"&id="+rand;
            var mailOptions ={
                from:'dev.medibox@gmail.com',
                to:req.body.to,
                sbject:'please confirm your email account',
                html : "Hello,<br> Please Click on the link to verify your email.<br><a href="+link+">Click here to verify</a>"
            };
            callback(null,mailOptions,rand);
        },
        function(mailData,secretKey,callback){
            console.log('mailData',mailData);
            smtpTransport.sendMail(mailData, function(error, response){
                if(error){
                    console.log(error);
                    return callback(true,"Error in sending email");
                }
                console.log("message sent :" +JSON.stringify(response));

                redisClient.set(req.body.to,secretKey);
                redisClient.expire(req.body.to,600);
                callback(null,"email sent successfully");
            });
        }
    ],
    function(err,data){
        console.log(err,data);
        res.json({error:err === null ? false :true,data:data });
    });
});

app.get('/verify',function(req,res){
    console.log('host>>>>>>>>>>>>>' +JSON.stringify(req.protocol));
    if((req.protocol+"://"+req.get('host')) === ("http://"+host)) {
    async.waterfall([
        function(callback) {
            var decodedMail = new Buffer(req.query.mail, 'base64').toString('ascii');
            redisClient.get(decodedMail,function(err,reply) {
                if(err) {
                    return callback(true,"Error in redis");
                }
                if(reply === null) {
                    return callback(true,"Invalid email address");
                }
                callback(null,decodedMail,reply);
            });
        },
        function(key,redisData,callback) {
            if(redisData === req.query.id) {
                redisClient.del(key,function(err,reply) {
                    if(err) {
                        return callback(true,"Error in redis");
                    }
                    if(reply !== 1) {
                        return callback(true,"Issue in redis");
                    }
                    callback(null,"Email is verified");
                });
            } else {
                return callback(true,"Invalid token");
            }
        }
    ],
        function(err,data) {
            res.send(data);
        });
} else {
    res.end("<h1>Request is from unknown source");
}
});

app.listen(5000,function(){
    console.log("express starting at 5000 port");
})



































