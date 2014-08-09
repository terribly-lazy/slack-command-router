var _ = require('lodash'),
    Formidable = require('formidable'),
    EventEmitter = require('events').EventEmitter;

function Slacker() {
}
_.assign(Slacker.prototype, EventEmitter.prototype);

function SlashCommand(body, res) {
    //Things from the server
    this.token = body.token;
    this.teamId = body.team_id;
    this.channelId = body.channel_id;
    this.channelName = body.channel_name;
    this.userId = body.user_id;
    this.userName = body.user_name;
    this.command = body.command;
    this.text = body.text;
    this.res = res;

    //State variables
    this._hasReplied = false;
}
_.assign(SlashCommand.prototype, {
    _generalReply: function() {
        if (this.hasReplied) {
            throw {
                message: "Only one handler can respond to a command"
            }
        }
        this.hasReplied = true;
    },
    replyUser: function (message) {
        this._generalReply();
        this.res.end(message);
    },
    tryReplyUser: function(message) {
        if (this.hasReplied)
            return false;

        this.replyUser(message);

        return true;
    },
    /* TODO
     replyChannel: function () {
     this._generalReply();
     this.res.end();
     },*/
    error: function (message) {
        this._generalReply();
        this.res.writeHead(400);
        this.res.end(message);
    },
    tryError: function (message) {
        if (this.hasReplied)
            return false;

        this.error(message);

        return true;
    }
});

function SlackIncoming(commands) {
    this.router = new Slacker();

    if (typeof commands === "object") {
        for (var handlerName in commands) {
            if (commands.hasOwnProperty(handlerName)) {
                this.registerHandler(commands[handlerName]);
            }
        }
    }
}

(function () {
    var checkedFields = ["token", "team_id", "channel_id", "channel_name", "user_id", "user_name", "command", "text"];

    function checkCommand(fields) {
        return _.xor(_.keys(fields), checkedFields).length === 0;
    }

    _.assign(SlackIncoming.prototype, {
        registerHandler: function (handler) {
            handler(this.router);
        },
        getMiddleware: function () {
            var self = this;
            return function (req, res, next) {
                var form = new Formidable.IncomingForm();
                form.encoding = 'utf-8';
                form.type = 'urlencoded';
                form.maxFieldsSize = 8192;
                form.maxFields = 15;
                form.parse(req, function (err, fields, files) {
                    if (err || !checkCommand(fields)
                        //Actually run the handlers
                        || !self.router.emit(fields.command.slice(1), new SlashCommand(fields, res))) {

                        //This will only happen if there were no handlers for our event
                        next();
                    }
                });
                form.on('error', function(){
                    next();
                });
                form.on('aborted', function(){
                    next();
                });
            }
        }
    });
})();

module.exports = SlackIncoming;