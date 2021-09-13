import express from 'express';
import path from 'path';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcrypt';

const app = express();
app.use(express.json());

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
                    eventList: []
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

app.post('/account/login', async (req, res) => {
    try {
        connectDB( async (database) => {
            const { username, password } = req.body;
            const user = await database.collection('users').findOne({ username: username });
            if (user == null) {
                res.status(500).json({ message: "Account does not exist!" });
            }
            if (await bcrypt.compare(password, user.password)) {
                res.send('Success!');
            } else {
                res.send('Failed to log in!');
            }
        })
    } catch (error) {
        console.error(error.toString());
        res.status(500).json({ message: error.toString() });
    }
});

app.listen(5000, () => console.log("Authentication Server started on port 5000"));