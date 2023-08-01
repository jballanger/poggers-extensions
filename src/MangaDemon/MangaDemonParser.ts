function recursiveDecodeURI(uri: string): string {
  const decodedUri = decodeURI(uri);
  if (uri === decodedUri) {
    return uri;
  }
  return recursiveDecodeURI(decodedUri);
}

const mangaIdToImageId = (mangaId: string) => {
  const mangaIdWithoutHyphens = mangaId.replaceAll('-', '%20');
  const decodedMangaId = recursiveDecodeURI(mangaIdWithoutHyphens);
  const formattedMangaId = decodedMangaId.replaceAll('%3A', ' ');
  return encodeURI(formattedMangaId);
};

export const parseMostViewedTodayPage = ($: cheerio.Root) => {
  const mostViewedMangaList = $('#topdaily ul li').toArray();
  const mangaList = mostViewedMangaList.map((element) => {
    const mangaLink = $('a', element).attr('href') || '';
    const mangaId = mangaLink.replace('/manga/', '').replace('-raw', '');
    const mangaTitle = $('.novel-title', element).text().trim();
    const image = encodeURI($('.novel-cover img', element).attr('src') || '');
    return App.createPartialSourceManga({
      mangaId,
      title: mangaTitle,
      image,
    });
  });
  return mangaList;
};

export const parseLatestUpdatePage = ($: cheerio.Root) => {
  const latestUpdateMangaList = $('#content ul li').toArray();
  const mangaList = latestUpdateMangaList.map((element) => {
    const mangaLinkTag = $('.novel-title a', element);
    const mangaLink = mangaLinkTag.attr('href') || '';
    const mangaId = mangaLink.replace('/manga/', '').replace('-raw', '');
    const mangaTitle = mangaLinkTag.text().trim();
    const image = encodeURI($('.novel-cover img', element).attr('src') || '');
    return App.createPartialSourceManga({
      mangaId,
      title: mangaTitle,
      image,
    });
  });
  return mangaList;
};

export const parseNewMangaPage = ($: cheerio.Root) => {
  const newMangaList = $('.container.vspace .section-body ul li').toArray();
  const mangaList = newMangaList.map((element) => {
    const mangaLinkTag = $('a', element);
    const mangaLink = mangaLinkTag.attr('href') || '';
    const mangaId = mangaLink.replace('/manga/', '').replace('-raw', '');
    const mangaTitle = $('.novel-title', element).text().trim();
    const image = encodeURI($('img.novcover', element).attr('src') || '');
    return App.createPartialSourceManga({
      mangaId,
      title: mangaTitle,
      image,
    });
  });
  return mangaList;
};

export const parseMangaPage = ($: cheerio.Root) => {
  const title = $('.novel-title').text().trim();
  const image = encodeURI($('#thumbonail').attr('src') || '');
  const headerStats = $('.header-stats');
  const status = headerStats.children().last().children().last().text();
  const author = $('.author').children().last().text();
  const description = $('.description').text();
  const tagsList = $('.categories ul li').toArray();
  const tags = tagsList.map((element) => {
    const tagLink = $(element).children();
    const tagLinkHref = tagLink.attr('href') || '';
    const genreParam =
      tagLinkHref.split('&').find((param) => param.includes('genre[]')) || '';
    const genreId = genreParam.replace('genre[]=', '');
    return App.createTag({
      id: genreId || '0',
      label: tagLink.text().trim(),
    });
  });
  const tagsSection = App.createTagSection({
    id: '0',
    label: 'genres',
    tags,
  });
  return App.createMangaInfo({
    titles: [title],
    image,
    status,
    author,
    desc: description,
    tags: [tagsSection],
  });
};

export const parseMangaChapters = ($: cheerio.Root) => {
  const chaptersListItems = $('.chapter-list li').toArray();
  const chapters = chaptersListItems.map((element) => {
    const chapterNumber = $(element).attr('data-chapterno') || '0';
    const chapterUpdate =
      $(element).children().last().children().last().attr('date') || '';
    return App.createChapter({
      id: chapterNumber,
      chapNum: Number(chapterNumber),
      langCode: '🇬🇧',
      time: new Date(chapterUpdate),
    });
  });
  return chapters;
};

export const parseMangaChapterDetails = ($: cheerio.Root) => {
  const chapterImages = $('.imgholder').toArray();
  const chapterPages = chapterImages.map((image) =>
    encodeURI($(image).attr('src') || ''),
  );
  return chapterPages;
};

export const parseMangaSearch = ($: cheerio.Root) => {
  const searchResults = $('body > a').toArray();
  const tiles = searchResults.map((searchResult) => {
    const mangaLink = $(searchResult).attr('href') || '';
    const mangaId = mangaLink.replace('/manga/', '').replace('-raw', '');
    const mangaTitle = $(searchResult).children().text();
    const imageId = mangaIdToImageId(mangaId);
    const image = `https://readermc.org/images/thumbnails/${imageId}.webp`;
    return App.createPartialSourceManga({
      mangaId,
      image,
      title: mangaTitle,
    });
  });
  return tiles;
};

export const parseMangaBrowse = ($: cheerio.Root) => {
  const searchResults = $('#content ul li').toArray();
  const tiles = searchResults.map((searchResult) => {
    const mangaTitleContainer = $('.novel-title a', $(searchResult));
    const mangaLink = mangaTitleContainer.attr('href') || '';
    const mangaId = mangaLink.replace('/manga/', '').replace('-raw', '');
    const mangaTitle = mangaTitleContainer.text().trim();
    const image = encodeURI(
      $('.novel-cover img', searchResult).attr('src') || '',
    );
    return App.createPartialSourceManga({
      mangaId,
      image,
      title: mangaTitle,
    });
  });
  return tiles;
};

export const parseTagsList = ($: cheerio.Root) => {
  const tagsList = $('form[action="browse.php"] ul li').toArray();
  const tags = tagsList.map((element) => {
    const tagId = $('input.genrespick', element).attr('value') || '';
    const tagLabel = $(element).text().trim();
    return App.createTag({
      id: tagId,
      label: tagLabel,
    });
  });
  return tags;
}
