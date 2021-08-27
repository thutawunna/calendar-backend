import bodyParser, { json } from 'body-parser';
import express from 'express';
import { MongoClient, ObjectID } from 'mongodb';
import path from 'path';
import { checkEventAvailability } from './helpers';

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

// Create a new Event
app.post('/api/events/add/', async (req, res) => {
    const { username, newEvent } = req.body;

    connectDB( async (database) => {
        const user = await database.collection('users').findOne({ username: username });
        if (user) {
            if (newEvent.start != newEvent.end) {
                if (checkEventAvailability(user.eventList, newEvent)) {
                    console.log("Adding New Event");
                    await database.collection('users').updateOne({ username: username }, {
                        '$set': {
                            eventList: user.eventList.concat(newEvent)
                        },
                    });
                    res.status(200).json({ message: "New Event Added!"});
                } else {
                    console.log("Time conflicts found. Please check your schedule!");
                    res.status(500).json({ message: "Time conflicts found. Please check your schedule!"});
                }
            } else {
                res.status(500).json({ message: "Event start and end cannot be the same!"});
            }
        } else {
            res.status(500).json({ message: "Error!" });
        }
    }, res);
});

// Cancel Event
app.post('/api/events/cancel/', async (req,res) => {
    const { username, eventToDelete } = req.body;

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

app.listen(8000, () => console.log("Listening on port 8000"));