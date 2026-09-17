update crawl_sources
set url = replace(url, 'www.reddit.com', 'old.reddit.com')
where url like '%www.reddit.com%';
