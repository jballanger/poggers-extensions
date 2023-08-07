import { load } from 'cheerio';
import {
  SourceInfo,
  SourceIntents,
  SourceManga,
  Chapter,
  ChapterDetails,
  ContentRating,
  HomeSection,
  HomeSectionType,
  SearchRequest,
  PagedResults,
  Request,
  Response,
  ChapterProviding,
  MangaProviding,
  SearchResultsProviding,
  HomePageSectionsProviding,
  PartialSourceManga,
  TagSection,
} from '@paperback/types';
import {
  parseMostViewedTodayPage,
  parseLatestUpdatePage,
  parseNewMangaPage,
  parseMangaPage,
  parseMangaChapters,
  parseMangaChapterDetails,
  parseMangaSearch,
  parseMangaBrowse,
  parseTagsList,
} from './MangaDemonParser';

const BASE_URL = 'https://mangademon.org';

export const MangaDemonInfo: SourceInfo = {
  version: '1.0.0',
  name: 'MangaDemon',
  icon: 'icon.png',
  author: 'jballanger',
  authorWebsite: 'https://github.com/jballanger',
  description: 'Source for mangademon.org',
  contentRating: ContentRating.EVERYONE,
  intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS,
  websiteBaseURL: BASE_URL,
};

export class MangaDemon
  implements
    SearchResultsProviding,
    MangaProviding,
    ChapterProviding,
    HomePageSectionsProviding
{
  requestManager = App.createRequestManager({
    requestsPerSecond: 5,
    requestTimeout: 20000,
    interceptor: {
      interceptRequest: async (request: Request): Promise<Request> => {
        request.headers = {
          ...(request.headers ?? {}),
          ...{
            referer: `${BASE_URL}/`,
            'user-agent': await this.requestManager.getDefaultUserAgent(),
          },
        };
        return request;
      },
      interceptResponse: async (response: Response): Promise<Response> => {
        return response;
      },
    },
  });

  homePageSections = [
    {
      section: App.createHomeSection({
        id: 'mostViewedToday',
        title: 'Most viewed today',
        containsMoreItems: false,
        type: HomeSectionType.singleRowNormal,
      }),
      request: App.createRequest({
        url: `${BASE_URL}/updates`,
        method: 'GET',
      }),
      parser: parseMostViewedTodayPage,
    },
    {
      section: App.createHomeSection({
        id: 'latestUpdates',
        title: 'Latest Updates',
        containsMoreItems: true,
        type: HomeSectionType.singleRowNormal,
      }),
      request: App.createRequest({
        url: `${BASE_URL}/updates`,
        method: 'GET',
      }),
      parser: parseLatestUpdatePage,
    },
    {
      section: App.createHomeSection({
        id: 'newManga',
        title: 'New manga',
        containsMoreItems: true,
        type: HomeSectionType.singleRowNormal,
      }),
      request: App.createRequest({
        url: BASE_URL,
        method: 'GET',
      }),
      parser: parseNewMangaPage,
    },
  ];

  getMangaShareUrl(mangaId: string): string {
    return `${BASE_URL}/manga/${mangaId}-raw`;
  }

  async getHomePageSections(
    sectionCallback: (section: HomeSection) => void,
  ): Promise<void> {
    const sectionsPromises: Array<Promise<void>> = [];
    this.homePageSections.forEach((pageSection) => {
      sectionCallback(pageSection.section);
      const requestPromise = this.requestManager
        .schedule(pageSection.request, 1)
        .then(async (response) => {
          const pageRoot = load(response.data as string);
          const sectionItems = await pageSection.parser(pageRoot);
          pageSection.section.items = sectionItems;
          sectionCallback(pageSection.section);
        });
      sectionsPromises.push(requestPromise);
    });
    await Promise.all(sectionsPromises);
  }

  async getViewMoreItems(
    homePageSectionId: string,
    metadata: any,
  ): Promise<PagedResults> {
    const results: Array<PartialSourceManga> = [];
    const section = this.homePageSections.find(
      (homePageSection) => homePageSection.section.id === homePageSectionId,
    );
    if (section) {
      const request = App.createRequest({
        url: section.request.url,
        method: section.request.method,
      });
      if (homePageSectionId === 'latestUpdates') {
        const page = metadata?.page || 1;
        request.url += `.php?list=${page}`;
        metadata = { page: page + 1 };
      }
      const response = await this.requestManager.schedule(request, 1);
      const pageRoot = load(response.data as string);
      const sectionItems = await section.parser(pageRoot);
      if (sectionItems.length < 1) {
        return App.createPagedResults({
          metadata,
        });
      }
      results.push(...sectionItems);
    }
    return App.createPagedResults({
      results,
      metadata,
    });
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const request = App.createRequest({
      url: `${BASE_URL}/manga/${mangaId}-raw`,
      method: 'GET',
    });
    const response = await this.requestManager.schedule(request, 1);
    const pageRoot = load(response.data as string);
    const mangaInfo = await parseMangaPage(pageRoot);
    return App.createSourceManga({
      id: mangaId,
      mangaInfo,
    });
  }

  async getChapters(mangaId: string): Promise<Chapter[]> {
    const request = App.createRequest({
      url: `${BASE_URL}/manga/${mangaId}-raw`,
      method: 'GET',
    });
    const result = await this.requestManager.schedule(request, 1);
    const pageRoot = load(result.data as string);
    const chapters = await parseMangaChapters(pageRoot);
    return chapters;
  }

  async getChapterDetails(
    mangaId: string,
    chapterId: string,
  ): Promise<ChapterDetails> {
    const request = App.createRequest({
      url: `${BASE_URL}/manga/${mangaId}/chapter/${chapterId}-raw`,
      method: 'GET',
    });
    const result = await this.requestManager.schedule(request, 1);
    const pageRoot = load(result.data as string);
    const chapterPages = await parseMangaChapterDetails(pageRoot);
    return App.createChapterDetails({
      id: chapterId,
      mangaId: mangaId,
      pages: chapterPages,
    });
  }

  async getSearchResults(
    searchQuery: SearchRequest,
    metadata: any,
  ): Promise<PagedResults> {
    if (searchQuery.title) {
      return this.searchManga(searchQuery.title);
    } else {
      return this.browseManga(searchQuery, metadata);
    }
  }

  async searchManga(search: string) {
    const request = App.createRequest({
      url: `${BASE_URL}/search.php?manga=${encodeURIComponent(search)}`,
      method: 'GET',
    });
    const result = await this.requestManager.schedule(request, 1);
    const pageRoot = load(result.data as string);
    const searchResult = await parseMangaSearch(pageRoot);
    return App.createPagedResults({
      results: searchResult,
    });
  }

  async browseManga(query: SearchRequest, metadata: any) {
    const genres: Array<string> = [];
    if (query.includedTags) {
      query.includedTags.forEach((tag) => {
        genres.push(`genre[]=${tag.id}`);
      });
    }
    const page = metadata?.page || 1;
    const params = [
      `list=${page}`,
      ...genres,
      'status=all',
      'orderby=VIEWS%20DESC',
    ];
    const request = App.createRequest({
      url: `${BASE_URL}/browse.php?${params.join('&')}`,
      method: 'GET',
    });
    const result = await this.requestManager.schedule(request, 1);
    const pageRoot = load(result.data as string);
    const searchResult = await parseMangaBrowse(pageRoot);
    return App.createPagedResults({
      results: searchResult,
      metadata: {
        page: page + 1,
      },
    });
  }

  async getSearchTags(): Promise<TagSection[]> {
    const request = App.createRequest({
      url: `${BASE_URL}/browse.php`,
      method: 'GET',
    });
    const result = await this.requestManager.schedule(request, 1);
    const pageRoot = load(result.data as string);
    const tags = await parseTagsList(pageRoot);
    const tagSection = App.createTagSection({
      id: '0',
      label: 'Genres',
      tags,
    });
    return [tagSection];
  }
}
