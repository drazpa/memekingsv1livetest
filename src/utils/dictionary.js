const commonWords = [
  'ABLE', 'ACID', 'AGED', 'ALSO', 'AREA', 'ARMY', 'AWAY', 'BABY', 'BACK', 'BALL',
  'BAND', 'BANK', 'BASE', 'BATH', 'BEAR', 'BEAT', 'BEEN', 'BEER', 'BELL', 'BELT',
  'BEST', 'BILL', 'BIRD', 'BLOW', 'BLUE', 'BOAT', 'BODY', 'BOMB', 'BOND', 'BONE',
  'BOOK', 'BOOM', 'BORN', 'BOSS', 'BOTH', 'BOWL', 'BULK', 'BURN', 'BUSH', 'BUSY',
  'CAFE', 'CAKE', 'CALL', 'CALM', 'CAME', 'CAMP', 'CARD', 'CARE', 'CART', 'CASE',
  'CASH', 'CAST', 'CELL', 'CHAT', 'CHEF', 'CHIP', 'CITY', 'CLUB', 'COAL', 'COAT',
  'CODE', 'COLD', 'COME', 'COOK', 'COOL', 'COPE', 'COPY', 'CORE', 'CORN', 'COST',
  'CREW', 'CROP', 'DARK', 'DATA', 'DATE', 'DAWN', 'DAYS', 'DEAD', 'DEAL', 'DEAR',
  'DEBT', 'DEEP', 'DENY', 'DESK', 'DIAL', 'DIET', 'DISC', 'DISK', 'DIVE', 'DOCK',
  'DOES', 'DOGS', 'DONE', 'DOOR', 'DOSE', 'DOWN', 'DRAW', 'DREW', 'DROP', 'DRUG',
  'DUAL', 'DUCK', 'DUMP', 'DUST', 'DUTY', 'EACH', 'EARN', 'EASE', 'EAST', 'EASY',
  'ECHO', 'EDGE', 'ELSE', 'EVEN', 'EVER', 'EVIL', 'EXIT', 'FACE', 'FACT', 'FAIL',
  'FAIR', 'FALL', 'FARM', 'FAST', 'FATE', 'FEAR', 'FEED', 'FEEL', 'FEET', 'FELL',
  'FELT', 'FILE', 'FILL', 'FILM', 'FIND', 'FINE', 'FIRE', 'FIRM', 'FISH', 'FLAT',
  'FLED', 'FLEW', 'FLOW', 'FOLK', 'FOOD', 'FOOT', 'FORD', 'FORM', 'FORT', 'FOUL',
  'FOUR', 'FREE', 'FROM', 'FUEL', 'FULL', 'FUND', 'GAIN', 'GAME', 'GATE', 'GAVE',
  'GEAR', 'GENE', 'GIFT', 'GIRL', 'GIVE', 'GLAD', 'GOAL', 'GOES', 'GOLD', 'GOLF',
  'GONE', 'GOOD', 'GRAD', 'GRAY', 'GREW', 'GREY', 'GRIP', 'GROW', 'GULF', 'HAIR',
  'HALF', 'HALL', 'HAND', 'HANG', 'HARD', 'HARM', 'HATE', 'HAVE', 'HEAD', 'HEAR',
  'HEAT', 'HELD', 'HELL', 'HELP', 'HERE', 'HERO', 'HIGH', 'HILL', 'HIRE', 'HOLD',
  'HOLE', 'HOLY', 'HOME', 'HOPE', 'HOST', 'HOUR', 'HUGE', 'HUNG', 'HUNT', 'HURT',
  'IDEA', 'INCH', 'INTO', 'IRON', 'ITEM', 'JACK', 'JANE', 'JAZZ', 'JEAN', 'JOHN',
  'JOIN', 'JUMP', 'JUNE', 'JURY', 'JUST', 'KEEN', 'KEEP', 'KENT', 'KEPT', 'KICK',
  'KILL', 'KIND', 'KING', 'KNEE', 'KNEW', 'KNOW', 'LACK', 'LADY', 'LAID', 'LAKE',
  'LAND', 'LANE', 'LAST', 'LATE', 'LEAD', 'LEFT', 'LESS', 'LIED', 'LIFE', 'LIFT',
  'LIKE', 'LINE', 'LINK', 'LIST', 'LIVE', 'LOAD', 'LOAN', 'LOCK', 'LONE', 'LONG',
  'LOOK', 'LORD', 'LOSE', 'LOSS', 'LOST', 'LOTS', 'LOUD', 'LOVE', 'LUCK', 'LUNG',
  'MADE', 'MAIL', 'MAIN', 'MAKE', 'MALE', 'MALL', 'MANY', 'MARK', 'MASS', 'MATE',
  'MATH', 'MEAL', 'MEAN', 'MEAT', 'MEET', 'MENU', 'MERE', 'MESS', 'MICE', 'MILE',
  'MILK', 'MILL', 'MIND', 'MINE', 'MISS', 'MODE', 'MOOD', 'MOON', 'MORE', 'MOST',
  'MOVE', 'MUCH', 'MUST', 'MYTH', 'NAME', 'NAVY', 'NEAR', 'NECK', 'NEED', 'NEWS',
  'NEXT', 'NICE', 'NINE', 'NONE', 'NOON', 'NORM', 'NOSE', 'NOTE', 'NOVEL', 'NURSE',
  'OKAY', 'ONCE', 'ONES', 'ONLY', 'ONTO', 'OPEN', 'ORAL', 'OVEN', 'OVER', 'PACE',
  'PACK', 'PAGE', 'PAID', 'PAIN', 'PAIR', 'PALM', 'PARK', 'PART', 'PASS', 'PAST',
  'PATH', 'PEAK', 'PICK', 'PIER', 'PILE', 'PINE', 'PINK', 'PIPE', 'PLAN', 'PLAY',
  'PLOT', 'PLUG', 'PLUS', 'POEM', 'POET', 'POLL', 'POND', 'POOL', 'POOR', 'PORT',
  'POST', 'POUR', 'PRAY', 'PRAY', 'PURE', 'PUSH', 'RACE', 'RACK', 'RAIL', 'RAIN',
  'RANK', 'RARE', 'RATE', 'READ', 'REAL', 'REAR', 'RELY', 'RENT', 'REST', 'RICE',
  'RICH', 'RIDE', 'RING', 'RISE', 'RISK', 'ROAD', 'ROCK', 'RODE', 'ROLE', 'ROLL',
  'ROOF', 'ROOM', 'ROOT', 'ROPE', 'ROSE', 'RUDE', 'RULE', 'RUSH', 'RUTH', 'SAFE',
  'SAGA', 'SAGE', 'SAID', 'SAKE', 'SALE', 'SALT', 'SAME', 'SAND', 'SANK', 'SAVE',
  'SEAT', 'SEED', 'SEEK', 'SEEM', 'SEEN', 'SELF', 'SELL', 'SEND', 'SENT', 'SEPT',
  'SHED', 'SHIP', 'SHOP', 'SHOT', 'SHOW', 'SHUT', 'SICK', 'SIDE', 'SIGN', 'SILK',
  'SING', 'SINK', 'SITE', 'SIZE', 'SKIN', 'SKIP', 'SLOW', 'SNOW', 'SOFT', 'SOIL',
  'SOLD', 'SOLE', 'SOME', 'SONG', 'SOON', 'SORT', 'SOUL', 'SOUP', 'SOUR', 'SPAN',
  'SPEC', 'SPIN', 'SPOT', 'STAR', 'STAY', 'STEM', 'STEP', 'STIR', 'STOP', 'SUCH',
  'SUED', 'SUIT', 'SUNG', 'SURE', 'SWIM', 'TALE', 'TALK', 'TALL', 'TANK', 'TAPE',
  'TASK', 'TEAM', 'TEAR', 'TECH', 'TELL', 'TEND', 'TERM', 'TEST', 'TEXT', 'THAN',
  'THAT', 'THEM', 'THEN', 'THEY', 'THIN', 'THIS', 'THOU', 'THUS', 'TIDE', 'TIED',
  'TIER', 'TILL', 'TIME', 'TINY', 'TOLL', 'TONE', 'TOOK', 'TOOL', 'TOPS', 'TORN',
  'TOUR', 'TOWN', 'TOYS', 'TREE', 'TREK', 'TRIM', 'TRIO', 'TRIP', 'TRUE', 'TUBE',
  'TUNE', 'TURN', 'TWIN', 'TYPE', 'UNIT', 'UPON', 'USED', 'USER', 'VARY', 'VAST',
  'VERY', 'VICE', 'VIEW', 'VISA', 'VOTE', 'WAGE', 'WAIT', 'WAKE', 'WALK', 'WALL',
  'WANT', 'WARD', 'WARM', 'WARN', 'WASH', 'WAVE', 'WAYS', 'WEAK', 'WEAR', 'WEEK',
  'WELL', 'WENT', 'WERE', 'WEST', 'WHAT', 'WHEN', 'WHOM', 'WIDE', 'WIFE', 'WILD',
  'WILL', 'WIND', 'WINE', 'WING', 'WIRE', 'WISE', 'WISH', 'WITH', 'WOOD', 'WORD',
  'WORE', 'WORK', 'WORM', 'WORN', 'WRAP', 'YARD', 'YEAH', 'YEAR', 'YELL', 'YOUR',
  'ZONE', 'ZOOM', 'MOON', 'PEEL', 'BEAM', 'LEAN', 'PEAK', 'RAGE', 'VIBE', 'DOGE'
];

export const getRandomWord = () => {
  return commonWords[Math.floor(Math.random() * commonWords.length)];
};

export const getRandomWords = (count = 1) => {
  const words = [];
  for (let i = 0; i < count; i++) {
    words.push(getRandomWord());
  }
  return words;
};
