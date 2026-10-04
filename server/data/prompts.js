/**
 * The prompt bank. Every prompt carries a suggested category and feeling so
 * answering one pre-fills the Add Memory form instead of dumping the person in
 * front of an empty database row. `weight` biases the shuffle: gentle openers
 * surface first for someone with an empty timeline.
 */

export const PROMPTS = [
  { id: 'never-forget', text: 'What is a memory you never want to forget?', hint: 'The one that came to mind immediately. Start there.', category: 'Other', feeling: 'Grateful', weight: 3, group: 'Core' },
  { id: 'who-shaped-you', text: 'Who helped shape who you are?', hint: 'A parent, a friend, a coach, someone who only passed through.', category: 'Person', feeling: 'Grateful', weight: 3, group: 'People' },
  { id: 'important-place', text: 'What place feels important in your life?', hint: 'Somewhere you could still walk through with your eyes closed.', category: 'Place', feeling: 'Nostalgic', weight: 3, group: 'Places' },
  { id: 'song-takes-you-back', text: 'What song takes you back to a specific time?', hint: 'Paste the link. Future you will want to hear it.', category: 'Music', feeling: 'Nostalgic', weight: 2, group: 'Media' },
  { id: 'best-childhood', text: 'What was one of your best childhood memories?', hint: 'Small and ordinary counts. Most of the good ones are.', category: 'Childhood', feeling: 'Happy', weight: 3, group: 'Core' },
  { id: 'survived', text: 'What is something difficult you survived?', hint: 'Only as much as you want to write. The point is that it is behind you.', category: 'Hard Moment', feeling: 'Resilient', weight: 2, group: 'Hard' },
  { id: 'proud-moment', text: 'What is a moment you are proud of?', hint: 'It does not have to be impressive to anyone else.', category: 'Achievement', feeling: 'Proud', weight: 3, group: 'Core' },
  { id: 'made-you-loved', text: 'Who made you feel loved or supported?', hint: 'What did they actually do? The specifics are the memory.', category: 'Person', feeling: 'Loved', weight: 3, group: 'People' },
  { id: 'first-accomplishment', text: 'What was your first real accomplishment?', hint: 'The first time you surprised yourself.', category: 'Achievement', feeling: 'Proud', weight: 2, group: 'Core' },
  { id: 'holiday-family', text: 'What holiday or family memory stands out?', hint: 'A smell, a room, who was at the table.', category: 'Holiday', feeling: 'Happy', weight: 2, group: 'People' },
  { id: 'used-to-love', text: 'What did you used to love doing?', hint: 'Something you stopped doing without really deciding to.', category: 'Childhood', feeling: 'Nostalgic', weight: 2, group: 'Identity' },
  { id: 'version-you-miss', text: 'What version of yourself do you miss?', hint: 'Not to get back to. Just to remember clearly.', category: 'Turning Point', feeling: 'Nostalgic', weight: 2, group: 'Identity' },
  { id: 'version-becoming', text: 'What version of yourself are you becoming?', hint: 'Write it as if it is already partly true, because it is.', category: 'Turning Point', feeling: 'Hopeful', weight: 2, group: 'Identity' },
  { id: 'hard-lesson', text: 'What lesson did life teach you the hard way?', hint: 'What you know now that you did not know then.', category: 'Lesson Learned', feeling: 'Strong', weight: 2, group: 'Hard' },
  { id: 'photo-story', text: 'What photo would tell part of your story?', hint: 'Upload it, or paste a link. Then say why that one.', category: 'Other', feeling: 'Nostalgic', weight: 2, group: 'Media' },

  { id: 'laughed-hardest', text: 'When did you laugh the hardest?', hint: 'The one you still tell people about.', category: 'Friendship', feeling: 'Happy', weight: 1, group: 'Core' },
  { id: 'kindness', text: 'What is the kindest thing someone did for you?', hint: 'They may not even know it mattered.', category: 'Person', feeling: 'Grateful', weight: 1, group: 'People' },
  { id: 'brave', text: 'When were you braver than you felt?', hint: 'Courage usually feels like nausea at the time.', category: 'Achievement', feeling: 'Strong', weight: 1, group: 'Hard' },
  { id: 'home-smell', text: 'What did home smell like growing up?', hint: 'Follow it. It usually leads somewhere.', category: 'Childhood', feeling: 'Nostalgic', weight: 1, group: 'Places' },
  { id: 'turning-point', text: 'What moment split your life into before and after?', hint: 'Good or bad. Both count.', category: 'Turning Point', feeling: 'Resilient', weight: 1, group: 'Identity' },
  { id: 'first-friend', text: 'Who was your first real friend?', hint: 'Where did you meet? What did you do together?', category: 'Friendship', feeling: 'Happy', weight: 1, group: 'People' },
  { id: 'school-teacher', text: 'Was there a teacher who changed something for you?', hint: 'What did they see in you?', category: 'School', feeling: 'Grateful', weight: 1, group: 'People' },
  { id: 'best-day-work', text: 'What is the best day you ever had at work?', hint: 'Or the day you knew you could do the job.', category: 'Work', feeling: 'Proud', weight: 1, group: 'Core' },
  { id: 'trip', text: 'Where did you go that you still think about?', hint: 'Who was with you?', category: 'Vacation', feeling: 'Happy', weight: 1, group: 'Places' },
  { id: 'forgave', text: 'What did you forgive, yourself or someone else?', hint: 'This one can be short.', category: 'Lesson Learned', feeling: 'Peaceful', weight: 1, group: 'Hard' },
  { id: 'kept-going', text: 'What kept you going through your worst stretch?', hint: 'A person, a habit, a song, a reason.', category: 'Hard Moment', feeling: 'Resilient', weight: 1, group: 'Hard' },
  { id: 'proud-of-someone', text: 'Who are you proud of, and why?', hint: 'Your memories can hold other people too.', category: 'Person', feeling: 'Proud', weight: 1, group: 'People' },
  { id: 'small-perfect', text: 'What is a small, perfectly ordinary moment you still have?', hint: 'A kitchen, a car ride, a Tuesday.', category: 'Other', feeling: 'Peaceful', weight: 1, group: 'Core' },
  { id: 'movie-video', text: 'What movie, show or video is tied to a memory for you?', hint: 'Drop the link in the video field.', category: 'Music', feeling: 'Nostalgic', weight: 1, group: 'Media' },
  { id: 'now', text: 'What is true about your life right now that you want to remember?', hint: 'Today becomes a memory eventually.', category: 'Other', feeling: 'Hopeful', weight: 1, group: 'Identity' },
];

export const PROMPT_GROUPS = ['Core', 'People', 'Places', 'Hard', 'Identity', 'Media'];
