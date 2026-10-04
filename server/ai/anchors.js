/**
 * Zero-shot value classification, done with an embedding model instead of a
 * labelled classifier.
 *
 * Each value gets several short, concrete example phrases rather than one long
 * abstract sentence. We embed all of them and average into a single prototype
 * vector per value. Multi-prototype anchors matter a lot with a small model
 * like MiniLM: one long sentence such as "family and the people who raised me
 * are at the center of my life" sits in a vague region of the space and
 * attracts almost anything, while "my grandmother's kitchen" / "sunday dinner
 * at my parents' house" pin the value to the way people actually write
 * memories. Concrete phrasing roughly doubled the separation in our tests.
 *
 * This is why an open model matters here: the anchor set is editable text, not
 * a hidden model behaviour. Anyone can fork this file and change what the app
 * is willing to notice about them.
 */

export const VALUE_ANCHORS = [
  { id: 'family', label: 'Family', examples: [
    "my grandmother's kitchen", 'sunday dinner at my parents house',
    'my mom took care of me when I was sick', 'holidays with my whole family',
    'my brother and I grew up sharing a room',
  ]},
  { id: 'loyalty', label: 'Loyalty', examples: [
    'I stayed with them through the worst of it', 'I never gave up on him',
    'she stood by me when nobody else did', 'I kept my promise even though it cost me',
  ]},
  { id: 'resilience', label: 'Resilience', examples: [
    'I survived it and kept going', 'the hardest year of my life and I made it through',
    'I got back up after losing everything', 'I was in a dark place and I came out of it',
    'I got clean and stayed clean',
  ]},
  { id: 'growth', label: 'Growth', examples: [
    'I am not the same person I was', 'that taught me a lesson I needed',
    'I changed how I saw everything after that', 'I finally understood what I had been doing wrong',
  ]},
  { id: 'love', label: 'Love', examples: [
    'the night I knew I loved her', 'holding my daughter for the first time',
    'we got married', 'I have never felt so loved by anyone',
  ]},
  { id: 'friendship', label: 'Friendship', examples: [
    'my best friend since third grade', 'late nights with my friends talking about nothing',
    'the group of us were inseparable', 'my friends showed up for me',
  ]},
  { id: 'achievement', label: 'Achievement', examples: [
    'I graduated', 'I got the job', 'I won the championship',
    'I finished what I started and I was proud', 'I earned it myself',
  ]},
  { id: 'creativity', label: 'Creativity', examples: [
    'I wrote a song about it', 'I taught myself to play guitar',
    'I made something with my hands', 'painting in my bedroom at night',
  ]},
  { id: 'adventure', label: 'Adventure', examples: [
    'we drove across the country', 'my first time on a plane',
    'road trip with the windows down', 'camping somewhere with no signal',
    'the summer we went to the coast',
  ]},
  { id: 'faith', label: 'Faith & meaning', examples: [
    'I prayed and something in me settled', 'church with my grandmother',
    'I felt like there was a reason for it', 'I found my purpose',
  ]},
  { id: 'humor', label: 'Humor', examples: [
    'we laughed until we could not breathe', 'the dumbest joke I still think about',
    'he could always make me laugh', 'that story we still tell every year',
  ]},
  { id: 'care', label: 'Caretaking', examples: [
    'I looked after my little sister', 'I took care of my mom when she got sick',
    'I was the one everybody came to', 'being needed gave me something to hold onto',
  ]},
  { id: 'independence', label: 'Independence', examples: [
    'I moved out on my own', 'my first apartment and my first paycheck',
    'I figured it out by myself', 'I did not need anyone to carry me',
  ]},
  { id: 'home', label: 'Home & place', examples: [
    'the house I grew up in', 'I can still picture that room',
    'my hometown', 'the porch where we sat every evening',
  ]},
  { id: 'hope', label: 'Hope', examples: [
    'I started to believe it could get better', 'something to look forward to',
    'I could finally see a future', 'the first day that felt like a fresh start',
  ]},
  { id: 'honesty', label: 'Honesty', examples: [
    'I told the truth even though it was hard', 'I admitted what I did',
    'I stopped pretending', 'I finally said what I actually felt',
  ]},
  { id: 'discipline', label: 'Discipline', examples: [
    'I showed up every single day', 'I trained for months',
    'I kept at it when it was boring', 'I saved for it little by little',
  ]},
  { id: 'service', label: 'Service', examples: [
    'I volunteered and it changed me', 'I helped someone who needed it',
    'I wanted to give something back', 'I made things better for other people',
  ]},
  { id: 'learning', label: 'Learning', examples: [
    'a teacher who believed in me', 'I was curious about how it worked',
    'I read everything I could find about it', 'I loved that class',
  ]},
  { id: 'peace', label: 'Peace', examples: [
    'a quiet morning with nothing to do', 'calm for the first time in years',
    'sitting by the water not thinking about anything', 'everything was still and okay',
  ]},
  { id: 'grief', label: 'Grief & loss', examples: [
    'the week before he died', 'the funeral',
    'I lost her and nothing was the same', 'saying goodbye at the hospital',
  ]},
];

/**
 * Narrative lenses for Explore My Story. Each one is a query vector: we rank
 * the person's memories by similarity to the lens, then compose from the top
 * matches. Adding a new section to Explore is literally adding an entry here.
 */
export const STORY_LENSES = [
  { id: 'life-story', label: 'My Life Story', blurb: 'The whole arc, chapter by chapter.', icon: 'book',
    mode: 'chronological',
    query: 'the story of my life, the chapters I have lived through, growing up and everything after' },
  { id: 'strengths', label: 'My Strengths', blurb: 'What you are actually good at.', icon: 'spark',
    mode: 'ranked',
    query: 'I was strong, I was brave, I was good at it, I handled it, I was capable' },
  { id: 'people', label: 'People Who Matter Most', blurb: 'Everyone who shaped you.', icon: 'people',
    mode: 'people',
    query: 'the people who shaped me, who loved me, who showed up for me and changed who I became' },
  { id: 'places', label: 'Places That Shaped Me', blurb: 'The map of your life.', icon: 'map',
    mode: 'places',
    query: 'a place I lived, the house I grew up in, a town, a room I still picture' },
  { id: 'overcame', label: 'Challenges I Overcame', blurb: 'Evidence that you survive things.', icon: 'shield',
    mode: 'ranked',
    query: 'something hard I lived through, I survived it, it nearly broke me and I made it out' },
  { id: 'what-memories-say', label: 'What My Memories Say About Me', blurb: 'The patterns you cannot see yourself.', icon: 'mirror',
    mode: 'themes',
    query: 'the kind of person I am, what I care about, what I keep coming back to' },
  { id: 'current-chapter', label: 'My Current Chapter', blurb: 'Where you are right now.', icon: 'compass',
    mode: 'recent',
    query: 'where I am right now, who I am becoming, what I am working toward lately' },
];

/** Feelings grouped by valence, used for the emotional arc, never to judge. */
export const FEELING_TONE = {
  Happy: 1, Proud: 1, Peaceful: 1, Motivated: 1, Loved: 1, Grateful: 1,
  Hopeful: 1, Strong: 1, Resilient: 1,
  Nostalgic: 0,
  Sad: -1, Regretful: -1, Anxious: -1, Angry: -1,
};

export const HARD_FEELINGS = ['Sad', 'Regretful', 'Anxious', 'Angry'];
export const HARD_CATEGORIES = ['Hard Moment', 'Turning Point', 'Lesson Learned'];

export const CATEGORIES = [
  'Person', 'Family', 'Friendship', 'Childhood', 'School', 'Work', 'Vacation',
  'Holiday', 'Achievement', 'Hard Moment', 'Turning Point', 'Lesson Learned',
  'Music', 'Place', 'Other',
];

export const FEELINGS = [
  'Happy', 'Proud', 'Peaceful', 'Motivated', 'Loved', 'Grateful', 'Sad',
  'Regretful', 'Anxious', 'Angry', 'Hopeful', 'Strong', 'Resilient', 'Nostalgic',
];
