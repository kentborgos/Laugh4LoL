-- r/Jokes dumps are mixed-room crowd work: keep them behind the late-show rope.
update jokes
set rating = 'adult'
where rating = 'clean'
  and (
    source_name like 'r/Jokes (SocialGrep%'
    or source_name like 'r/Jokes (taivop%'
    or source_name = 'Reddit r/Jokes'
    or source_name = 'Reddit r/DirtyJokes'
  );

delete from jokes
where body ~* '\y(rape|rapist|raping|holocaust|nigger|nigga|kike|faggot|lynch|lynching)\y';
