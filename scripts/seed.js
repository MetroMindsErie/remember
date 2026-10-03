/**
 * Seeds a small, realistic timeline so you can see Remember working before you
 * have written anything yourself. `npm run seed -- --reset` clears first.
 */
const BASE = process.env.BASE || 'http://localhost:3000';

const SEED = [
  { title: "Nana's kitchen on Sunday mornings", memory_text: "Every Sunday she'd have the bread going before anyone else was up. I'd come down and she'd hand me the end piece with butter, still too hot. The radio was always on the gospel station. She never once made me feel like I was in the way.", people: ['Nana'], place: "Nana's house, Topeka", time_period: 'childhood', category: 'Family', feeling: 'Loved', meaning: "This is where I learned that being fed by someone is a kind of love. I still make bread when I'm anxious.", tags: ['nana', 'sundays', 'bread'], prompt: 'What is one of your best childhood memories?' },
  { title: 'Driving to the coast the summer after graduation', memory_text: "Four of us in Marcus's Civic with no AC and a CD binder. We got there at 2am and slept on the beach because nobody had booked anything. Woke up covered in sand and it was the best I've ever felt.", people: ['Marcus', 'Dee', 'Sam'], place: 'Gulf Shores', time_period: 'summer of 2012', category: 'Friendship', feeling: 'Happy', meaning: "That was the last time all four of us were in the same place with nothing we had to do. I didn't know that at the time.", tags: ['roadtrip', 'friends', 'summer'], music_url: 'https://open.spotify.com/track/7GhIk7Il098yCjg4BQjzvb', prompt: 'What song takes you back to a specific time?' },
  { title: 'The week before Dad died', memory_text: "I sat with him in the hospital every evening after work. Mostly we didn't talk. He asked me to fix the gutter on the house and I said I would. I did, that October.", people: ['Dad', 'Mom'], place: 'St. Francis', time_period: 'October 2019', category: 'Hard Moment', feeling: 'Sad', meaning: "I showed up. Whatever else I've gotten wrong, I showed up for that.", tags: ['dad', 'grief', 'loss'] },
  { title: 'Three years clean', memory_text: "I didn't tell anybody on the actual day. I just drove to the lake and sat there for an hour. Three years earlier I'd been in the worst shape of my life and genuinely did not think I'd see this.", people: [], place: 'Lake Shawnee', time_period: '2023', category: 'Turning Point', feeling: 'Resilient', meaning: "Proof. That's the whole thing. It's proof that the worst version of my life wasn't the final version.", tags: ['recovery', 'proof', 'milestone'] },
  { title: 'Graduating, finally, at 27', memory_text: "Took me six years because I was working full time the whole way through. Mom drove four hours to be there. I could see her from the stage because she was the loudest person in the building.", people: ['Mom'], place: 'Washburn University', time_period: 'age 27', category: 'Achievement', feeling: 'Proud', meaning: "Nobody handed me that. I paid for every credit hour of it myself.", tags: ['school', 'mom', 'persistence'], prompt: 'What is a moment you are proud of?' },
  { title: 'The apartment on 8th with the broken radiator', memory_text: "First place that was only mine. A mattress on the floor, one pan, and a window that looked at a brick wall. I was broke and weirdly happy.", people: [], place: '8th Street apartment', time_period: 'age 22', category: 'Place', feeling: 'Peaceful', meaning: "I learned I could take care of myself in that apartment. That knowledge never went away.", tags: ['first apartment', 'independence'] },
  { title: 'Mr. Alvarez kept me in school', memory_text: "Tenth grade, I was failing everything and about to quit. He made me come to his room at lunch and do the work in front of him. He never once lectured me about it.", people: ['Mr. Alvarez'], place: 'Highland Park High', time_period: '10th grade', category: 'School', feeling: 'Grateful', meaning: "Somebody decided I was worth the inconvenience. That changed what I thought was possible for me.", tags: ['teacher', 'school', 'turning point'], prompt: 'Who helped shape who you are?' },
  { title: 'Teaching Dee to drive stick in the church parking lot', memory_text: "She stalled it probably forty times and we laughed so hard I had to get out of the car. Still one of the top five times I've laughed in my life.", people: ['Dee', 'Marcus'], place: 'First Baptist parking lot', time_period: '2014', category: 'Friendship', feeling: 'Happy', meaning: "We were idiots and it was great. I want to remember being that uncomplicated.", tags: ['dee', 'laughing', 'friends'] },
  { title: 'Christmas when Mom made it work anyway', memory_text: "The year after the layoff. She got us a tree from a lot that was giving them away on the 23rd and we made ornaments out of magazine pages. I didn't find out until years later how bad things actually were.", people: ['Mom', 'Nana'], place: 'Topeka', time_period: 'Christmas 2008', category: 'Holiday', feeling: 'Grateful', meaning: "She protected us from knowing. I think about that whenever I'm scared about money.", tags: ['christmas', 'mom', 'family'], prompt: 'What holiday or family memory stands out?' },
  { title: 'Starting the shop', memory_text: "Signed the lease in February with nine months of savings and no idea what I was doing. Still open.", people: ['Sam'], place: 'Topeka', time_period: 'last year', category: 'Work', feeling: 'Hopeful', meaning: "This is the chapter I'm in right now and I don't know how it ends yet.", tags: ['work', 'shop', 'risk'], prompt: 'What version of yourself are you becoming?' },
];

const log = (...a) => console.log('[seed]', ...a);

async function main() {
  if (process.argv.includes('--reset')) {
    const res = await fetch(`${BASE}/api/memories`);
    const { memories } = await res.json();
    for (const m of memories) await fetch(`${BASE}/api/memories/${m.id}`, { method: 'DELETE' });
    log(`cleared ${memories.length}`);
  }
  for (const m of SEED) {
    const res = await fetch(`${BASE}/api/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(m),
    });
    if (!res.ok) log('FAILED', m.title, await res.text());
  }
  log(`added ${SEED.length} memories → ${BASE}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
