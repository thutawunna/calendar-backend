import bodyParser, { json } from 'body-parser';
import express from 'express';
import { MongoClient, ObjectID } from 'mongodb';
import path from 'path';

const app = express();

app.use(express.static(path.join(__dirname, 'build')));
app.use(bodyParser.json());

const connectDB = async ( operations, res ) => {
    try {
        const client = await MongoClient.connect('mongodb://localhost:27017/', { useNewUrlParser: true });
        const database = client.db('calendar-app');

        await operations(database);

        client.close();
    } catch (error) {
        res.status(500).json({ message: error.toString() });
    }
}

app.get('/api/events/get/', async (req, res) => {
    connectDB( async (database) => {
        const username = req.query.username;
        const user = await database.collection('users').findOne({ username: username });
        if (user != null) {
            res.status(200).json({ events: user.eventList });
        }
    }, res);
});

app.post('/api/events/add/', async (req, res) => {
    const { username, newEvent } = req.body;

    connectDB( async (database) => {
        const user = await database.collection('users').findOne({ username: username });
        if (user) {

            if (user.eventList.find(event => event.start === newEvent.date)) {
                console.log("Event Already Exists");
            } else {
                await database.collection('users').updateOne({ username: username }, {
                    '$set': {
                        eventList: user.eventList.concat( newEvent )
                    },
                });
            }
            res.status(200).json({ message: "New Event Added! "});
        } else {
            res.status(500).json({ message: "Error!" });
        }
    }, res);
})

app.listen(8000, () => console.log("Listening on port 8000"));