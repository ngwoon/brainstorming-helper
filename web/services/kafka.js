const kafka = require("kafka-node");
const CustomError = require("../errors");

const PRODUCER_OPTIONS = {

};
const CUSTOMER_OPTIONS = {

};
let IS_PRODUCER_READY = 0;

const client = new kafka.KafkaClient({ kafkaHost: "127.0.0.1:9092" });
const producer = new kafka.Producer(client);
const stuckedMessages = [];

producer.on("ready", () => {
    IS_PRODUCER_READY = 1;
    sendStuckedMessages();
});
producer.on("error", (error) => {
    throw new CustomError("Kafka Producer Error", 500, error);
});

function sendStuckedMessages() {
    for(const message of stuckedMessages) {
        console.log(message);
        const kafkaMessage = [{ topic: message.topic, messages: message.messages }];
        producer.send(kafkaMessage, (error, data) => {
            if(error) {
                throw new CustomError("Kafka producer send message error", 500, error);
            } else {
                console.log("send message!");
                console.log(data);
            }
        });
    }
}

class KafkaDriver {
    static sendMessage(topic, messages) {
        console.log("sendMessage method in");
        
        if(IS_PRODUCER_READY) {
            const kafkaMessage = [{ topic, messages }];
            producer.send(kafkaMessage, (error, data) => {
                if(error) {
                    throw new CustomError("Kafka producer send message error", 500, error);
                } else {
                    console.log("send message!");
                    console.log(data);
                }
            });
        } else {
            console.log("producer is not ready");
            stuckedMessages.push({ topic, messages });
        }
    }

    static async createTopic(topic) {
        // To check topic already exists
        // If exist, do not create topic
        try {
            await new Promise((resolve, reject) => {
                client.loadMetadataForTopics([topic], (error, result) => {
                    const topics = Object.keys(result[1].metadata);
                    if(topics.includes(topic))
                        reject(result);
                    else
                        resolve();
                });
            });
        } catch(error) {
            return;
        }

        const topicsToCreate = [
            {
                topic,
                partitions: 1,
                replicationFactor: 1,
            },
        ];
        return new Promise((resolve, reject) => {
            client.createTopics(topicsToCreate, (error, result) => {
                if(result) {
                    reject(result);
                } else {
                    console.log(`[Kafka] Create topic '${topic}' Successfully`);
                    resolve();
                }
            });
        });
    }
}

module.exports = KafkaDriver;