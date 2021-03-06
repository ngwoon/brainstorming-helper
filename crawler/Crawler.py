#%%

from datetime import datetime
from kafka.metrics import measurable
from pyspark.streaming.kafka import KafkaUtils
from pyspark import SparkContext
from pyspark.streaming import StreamingContext
from kafka import KafkaProducer
from urllib.request import urlopen
from bs4 import BeautifulSoup
import re

BROKER_LIST = "192.168.56.19:9092"
CONSUMER_TOPIC = "urls"
PRODUCER_TOPIC = "crawledResults"

sc = SparkContext(appName='crawl')
ssc = StreamingContext(sc, 2)
sc.setLogLevel("WARN")
urls = KafkaUtils.createDirectStream(ssc, topics=[CONSUMER_TOPIC], 
                                    kafkaParams={"metadata.broker.list": BROKER_LIST})

def get_text(tag):
    return re.sub(r'[^\w]+',' ',tag.get_text())

def get_contents(t):

    try:
        key = t[0]
        html = urlopen(t[1])
    
        soup = BeautifulSoup(html, 'html.parser')
    
        head = soup.find_all(['h1','h2','h3'])
        content = soup.find_all('p')    

        head = ' '.join(map(get_text, head))
        content = ' '.join(map(get_text, content))

        return key, content

    except:
        pass


def func1(t):
    key = t[0]
    values = t[1].split(" ")

    return [(key, value) for value in values]

def func2(t):
    key = t[0]
    url = t[1]
    return True if 'http' in url else False

urls = urls.flatMap(lambda x: func1(x))
urls = urls.filter(lambda x: func2(x))
contents = urls.map(lambda url: get_contents(url))

producer = KafkaProducer(bootstrap_servers=BROKER_LIST, key_serializer=str.encode, value_serializer=str.encode)

def push_to_topics(data, topic=PRODUCER_TOPIC):
    
    data = data.collect()
    if not data:
        return
         
    else:        
        for t in data:
            producer.send(topic, key=t[0], value=t[1])
        producer.flush()
    

contents.foreachRDD(lambda x: push_to_topics(x))
contents.pprint()

ssc.start()
ssc.awaitTermination()
#%%
