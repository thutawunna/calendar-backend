import bodyParser, { json } from 'body-parser';
import express from 'express';
import { MongoClient, ObjectID } from 'mongodb';
import path from 'path';
import { checkEventAvailability, validateEvent } from './helpers';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import moment from 'moment';

moment().format();

require('dotenv').config()

const app = express();

app.use(express.static(path.join(__dirname, 'build')));
app.use(cookieParser(process.env.COOKIE_PARSER_SECRET));
app.use(bodyParser.json());

const connectDB = async ( operations, res ) => {
    try {
        const uri = `mongodb+srv://calendar_app:${process.env.MONGODB_SECRET}@cluster0.cmuws.mongodb.net/calendar_app?retryWrites=true&w=majority`;
        const client = await MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
        const database = client.db('calendar-app');

        await operations(database);

        client.close();
    } catch (error) {
        console.log(error.toString());
    }
}

// GET Events (Web)

app.get('/api/events/get/', authenticateToken, async (req, res) => {
    connectDB( async (database) => {
        const username = req.user.username;
        const user = await database.collection('users').findOne({ username: username });
        if (user != null) {
            res.status(200).json({ events: user.eventList });
        } else {
            res.status(500).json({ message: 'User Not Found' });

        }
    }, res);
});

// POST get events (Slack)

app.post('/api/slack/events/get', async (req, res) => {
    
    connectDB( async (database) => {
        const { slackUserID, date, grain } = req.body;
        console.log(req.body);
        const user = await database.collection('users').findOne({ slackAccountID: slackUserID });

        console.log(grain);

        if (user != null) {
            if (user.slackVerified) {
                const eventList = user.eventList;
                if (date) {
                    let filteredEventList;
                    if (grain === 'day') {
                        filteredEventList = eventList.filter(event => (
                            moment(date.split('T')[0]).isSame(moment(event.start.split('T')[0]), 'day')
                        ));
                    } else if (grain === 'week') {
                        filteredEventList = eventList.filter(event => (
                            moment(date.split('T')[0]).isSame(moment(event.start.split('T')[0]), 'week')
                        ));
                    }
                    
                    console.log('Returning Events');
                    return res.status(200).json({ events: filteredEventList });
                }
                return res.status(500).json({ message: "Please Enter a Date!" });
            }
            return res.status(500).json({ message: "Please verify your slack account!"});
            
        }
        return res.status(500).json({ message: "Error!" });
    }, res);
});

// Create a new Event (Web)
app.post('/api/events/add/', authenticateToken, async (req, res) => {
    const username = req.user.username;
    const { newEvent } = req.body;

    const newEventStart = new Date(newEvent.start);
    newEventStart.setSeconds(0,0);
    const newEventEnd = new Date(newEvent.end);
    newEventEnd.setSeconds(0,0);

    const eventToCreate = {
        title: newEvent.title,
        start: newEventStart.toISOString(),
        end: newEventEnd.toISOString()
    }

    connectDB( async (database) => {
        const user = await database.collection('users').findOne({ username: username });
        if (user) {

            if (validateEvent(newEvent)) {
                if (checkEventAvailability(user.eventList, eventToCreate)) {
                    console.log("Adding New Event");
                    await database.collection('users').updateOne({ username: username }, {
                        '$set': {
                            eventList: user.eventList.concat(eventToCreate)
                        },
                    });
                    res.status(200).json({ message: "New Event Added!"});
                } else {
                    console.log("Time conflicts found. Please check your schedule!");
                    res.status(500).json({ message: "Time conflicts found. Please check your schedule!" });
                }
            } else {
                res.status(500).json({ message: "Error in new event!" })
            }
        } else {
            res.status(500).json({ message: "Error!" });
        }
    }, res);
});

// Create Event (Slack)
app.post('/api/slack/events/add/', async (req, res) => {
    const { newEvent, slackID } = req.body;

    connectDB( async (database) => {

        const user = await database.collection('users').findOne({ slackAccountID: slackID });
        if (user) {

            if (validateEvent(newEvent)) {
                if (checkEventAvailability(user.eventList, newEvent)) {
                    
                    if (user.slackVerified) {
                        console.log("Adding New Event");
                        await database.collection('users').updateOne({ username: user.username }, {
                            '$set': {
                                eventList: user.eventList.concat(newEvent)
                            },
                        });
                        return res.status(200).json({ message: "New Event Added!" });
                    } else {
                        console.log('Slack Account not verified');
                        return res.status(403).json({ message: "Slack Account not verified" });
                    }
                }
                console.log("Time conflicts detected!");
                return res.status(500).json({ message: "You already have an event scheduled at this time!" });
            }
        }
        return res.sendStatus(500);
    }, res);
});

// Cancel Event
app.post('/api/events/cancel/', authenticateToken, async (req,res) => {
    const { eventToDelete } = req.body;
    const username = req.user.username;

    connectDB( async (database) => {
        const user = await database.collection('users').findOne({ username: username });
        if (user) {
            let updatedEvents = user.eventList.filter(event => (event.start !== eventToDelete.start));
            console.log("Deleting Event");
            await database.collection('users').updateOne({ username: username }, {
                '$set': {
                    eventList: updatedEvents
                },
            });
            res.status(200).json({ message: "Event Deleted!" });
        } else {
            res.status(500).json({ message: "Unable to delete Event!" });
        }

    }, res);
});

// ---------------------------------------- User Authentication ---------------------------------------- //

// Register Account
app.post('/account/register', async (req, res) => {
    try {
        connectDB( async (database) => {
            const { username, password } = req.body;
            const checkUser = await database.collection('users').findOne({ username: username });
            if  (checkUser === null) {
                let salt = await bcrypt.genSalt();
                const newUser = {
                    username: username,
                    password: await bcrypt.hash(password, salt),
                    eventList: [],
                    slackAccountID: '',
                    slackVerified: false
                }
                await database.collection('users').insertOne(newUser);
                res.status(200).json({ message: "Account Created!" });
            } else {
                res.status(500).json({ message: "Account already exists!" });
            }
        }, res);
    } catch (error) {
        console.error(error.toString());
        res.status(500).json({ message : error.toString() })
    }
});

app.post('/account/connect/slack', async (req, res) => {
    connectDB( async (database) => {
        const { slackUserID, username } = req.body;

        const matchingSlackID = await database.collection('users').findOne({ slackAccountID: slackUserID });
        if (matchingSlackID != null) {
            return res.status(403).json({ message: "You already have an account connected to this slack user!" });
        }

        const checkUser = await database.collection('users').findOne({ username: username });
        if (checkUser != null) {
            await database.collection('users').updateOne({ username: username }, {
                '$set': {
                    slackAccountID: slackUserID,
                    slackVerified: false,
                },
            });
            res.status(200).json({ message: "Slack Account Connected! Pending User Verfication." });
        } else {
            res.status(500).json({ message: "Account does not exist"});
        }
    }, res);
});

// Verify Slack Account
app.post('/account/slack/verify', async (req, res) => {
    connectDB( async (database) => {

        const { username, password } = req.body;
        
        const user = await database.collection('users').findOne({ username: username });
        if (user != null) {
            if (await bcrypt.compare(password, user.password)) {
                if (user.slackAccountID != '') {
                    if (!user.slackVerified) {
                        await database.collection('users').updateOne({ username: user.username }, {
                            '$set': {
                                slackVerified: true
                            }
                        });
                        return res.status(200).json({ message: "Slack Account Verified!" });
                    }
                    return res.status(500).json({ message: "Account already verified "});
                }
                return res.status(500).json({ message: "No Slack ID Associated to this account" });
            }
        }
        return res.status(500).json({ message: 'Error' });
    }, res);
});

// Login
app.post('/account/login', async (req, res) => {
    try {
        connectDB( async (database) => {
            const { username, password } = req.body;
            const user = await database.collection('users').findOne({ username: username });
            if (user == null) {
                res.status(500).json({ message: "Account does not exist!" });
            }
            if (await bcrypt.compare(password, user.password)) {
                const userCredential = { username: user.username };
                const accessToken = generateAccessToken(userCredential);
                const refreshToken = jwt.sign(userCredential, process.env.REFRESH_TOKEN_SECRET);
                
                await database.collection('refreshTokens').insertOne({refreshToken: refreshToken});
                res.cookie('cali-app-remember', accessToken, { maxAge: 600000, httpOnly:true, signed: true });
                res.cookie('cali-app-authenticated', true, { maxAge: 600000 });
                let milliseconds_in_a_year = 365 * 24 * 60 * 60 * 1000;
                res.cookie('cali-app-refresh', refreshToken, { maxAge: milliseconds_in_a_year, httpOnly: true, signed: true });
                res.cookie('cali-app-refresh-exists', true, { maxAge: milliseconds_in_a_year });
                res.sendStatus(200);
            } else {
                res.send('Failed to log in!');
            }
        }, res);
    } catch (error) {
        console.error(error.toString());
        res.status(500).json({ message: error.toString() });
    }
});

// Refresh Access Token
app.post('/token', (req, res) => {
    connectDB( async (database) => {
        const token = cookieParser.signedCookie(req.signedCookies['cali-app-refresh'], process.env.COOKIE_PARSER_SECRET);

        if (token === null) return res.sendStatus(401);
        const refreshToken = await database.collection('refreshTokens').findOne({ refreshToken: token });
        if (refreshToken === null) return res.sendStatus(403);
        
        jwt.verify(refreshToken.refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
            const accessToken = generateAccessToken({ username: user.username });
            res.cookie('cali-app-remember', accessToken, { maxAge: 600000, httpOnly:true, signed: true });
            res.cookie('cali-app-authenticated', true, { maxAge: 600000 });
            let milliseconds_in_a_year = 365 * 24 * 60 * 60 * 1000;
            res.cookie('cali-app-refresh-exists', true, { maxAge: milliseconds_in_a_year });
            res.sendStatus(200);
        });
        
    }, res);
});

// Delete Refresh Token
app.post('/account/logout', (req, res) => {
    connectDB( async (database) => {
        const token = cookieParser.signedCookie(req.signedCookies['cali-app-refresh'], process.env.COOKIE_PARSER_SECRET);

        if (token === null) return res.sendStatus(401);
        const refreshToken = await database.collection('refreshTokens').findOne({ refreshToken: token });
        if (refreshToken === null) return res.sendStatus(403);

        await database.collection('refreshTokens').deleteOne(refreshToken);
        
        res.cookie('cali-app-remember', '1', { maxAge: 0 });
        res.cookie('cali-app-authenticated', '1', { maxAge: 0 });
        res.cookie('cali-app-refresh', '1', { maxAge: 0 });
        res.cookie('cali-app-refresh-exists', '1', { maxAge: 0 });
        console.log('Logged Out');
        res.sendStatus(200);
    }, res);
});

// ---------------------------------------- Middlewares ---------------------------------------- //

// Authenticate Token Middleware
function authenticateToken(req, res, next) {
    // const authenticateHeader = req.headers['authorization'];
    // const token = authenticateHeader && authenticateHeader.split(' ')[1];

    const token = cookieParser.signedCookie(req.signedCookies['cali-app-remember'], process.env.COOKIE_PARSER_SECRET);

    if (token == null) {
        return res.sendStatus(401);
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) {
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
}

function generateAccessToken(user) {
    return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '600s'});
}

app.listen(8000, () => console.log("Listening on port 8000"));