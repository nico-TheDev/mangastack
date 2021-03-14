import { useState, useEffect } from 'react';
import { connect } from 'react-redux';
import { useParams } from 'react-router-dom';
import { Grid, Typography, List, ListItem, LinearProgress, Box } from '@material-ui/core';
import { Alert, AlertTitle } from '@material-ui/lab';
import { Helmet } from 'react-helmet';
import ChapterList from './ChapterList';
import PageNavigation from './PageNavigation';
import Loader from './Loader';
import axios from '../config/axios';
import { getEnglishChaptersWithGroups, useMangaData } from '../hooks/mangadex-api';
import { setReading } from '../actions/mangaList';
import { htmlDecode, generateMetaKeywordsTitle } from '../utils/utils';

const ReadChapterPage = ({ setReading }) => {
  const { mangaId, chapterId } = useParams();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allChapters, setAllChapters] = useState([]);
  const [chapterInfo, setChapterInfo] = useState({});
  const [chapterPages, setChapterPages] = useState([]);
  const [imagesLoaded, setImagesLoaded] = useState(0);
  
  const { mangaInfo } = useMangaData(mangaId);

  useEffect(() => {
    const fetchChapterInfo = async () => {
      const response = await axios.get(`/api/manga/${mangaId}/chapters`);
      const { chapters, groups } = response.data.data;
      setAllChapters(getEnglishChaptersWithGroups(chapters, groups));
      const currentChapter = chapters.find((chapter) => chapter.id === parseInt(chapterId));
      if (!currentChapter) {
        throw new Error();
      }
      setChapterInfo(currentChapter);
      setReading({ id: mangaId }, currentChapter);
      return currentChapter.hash;
    };

    const fetchPages = async (hash) => {
      const response = await axios.get(`/api/chapter/${hash}`);
      const { pages, server } = response.data.data;
      const pageURLs = pages.map((page) => `${server}${hash}/${page}`);
      setChapterPages(pageURLs);
      setImagesLoaded(0);
      setTimeout(() => {
        setImagesLoaded(pageURLs.length);
      }, 10000)
    };

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const chapterHash = await fetchChapterInfo();
        await fetchPages(chapterHash);
      } catch (e) {
        setError(`An error occured while fetching the chapter data.\nPlease make sure the IDs in the URL point to valid resources.`);
      }
      setIsLoading(false);
    };
    fetchData();
  }, [chapterId]);

  const imagesLoading = !(chapterPages.length > 0 && imagesLoaded >= chapterPages.length);

  const pagesToDisplay = chapterPages.map((chapterPage, index) => (
    <ListItem key={chapterPage}>
      <img
        style={{
          width: '100%',
          display: imagesLoading ? 'none' : 'block'
        }}
        src={chapterPage}
        alt={`Error loading page ${index + 1}`}
        onLoad={() => setImagesLoaded(imagesLoaded + 1)} />
    </ListItem>
  ));

  if (isLoading) {
    return <Loader />;
  } else if (error) {
    return (
      <Alert severity="error">
        <AlertTitle>Error</AlertTitle>
        {error}
      </Alert>
    );
  } else {
    const { id: chapterId, mangaTitle, chapter: chapterNumber, title, groups } = chapterInfo;
    let prevChapter, nextChapter, scanlatorNames;
    if (allChapters) {
      const index = allChapters.findIndex((chapter) => chapter.id === chapterId);

      // Find the previous/next chapter's number
      let prevChapterNumber;
      for (let i = index; i < allChapters.length; i += 1) {
        if (chapterNumber !== allChapters[i].chapter) {
          prevChapterNumber = allChapters[i].chapter;
          break;
        }
      }

      let nextChapterNumber;
      for (let i = index; i >= 0; i -= 1) {
        if (chapterNumber !== allChapters[i].chapter) {
          nextChapterNumber = allChapters[i].chapter;
          break;
        }
      }

      // Get all chapters with the same number as the previous/next chapter
      const beforeChapters = allChapters.filter((chapter) => chapter.chapter === prevChapterNumber);
      const beforeBySameScanlator = beforeChapters.find((chapter) => {
        for (const group of groups) {
          return chapter.groups[group] !== undefined;
        }
      });

      const afterChapters = allChapters.filter((chapter) => chapter.chapter === nextChapterNumber);
      const afterBySameScanlator = afterChapters.find((chapter) => {
        for (const group of groups) {
          return chapter.groups[group] !== undefined;
        }
      });

      // If the previous/next chapter has a scan by the same scanlator, link to that one
      prevChapter = beforeBySameScanlator || beforeChapters[beforeChapters.length - 1];
      nextChapter = afterBySameScanlator || afterChapters[afterChapters.length - 1];

      const currentChapterFoundInList = allChapters.find((chapter) => chapter.id === chapterId);
      scanlatorNames = Object.values(currentChapterFoundInList.groups).join(', ');
    }

    const chapterBaseURL = `/manga/${mangaId}/chapter/`;
    return (
      <>
        <Helmet>
          <title>
            {`${mangaTitle} - Chapter ${chapterNumber}${title ? `: ${title}` : ''} - MangaStack`}
          </title>
          <meta
            name="description"
            content={htmlDecode(mangaInfo.description).replace(/\[.*?\]/g, '')}
          />
          <meta
            name="keywords"
            content={generateMetaKeywordsTitle(mangaTitle)}
          />
        </Helmet>
        <Grid
          container
          direction="column"
          justify="center"
          alignItems="center"
        >
          <Grid item xs="auto" sm={1} md={4} />
          <Grid item xs={12} sm={10} md={8}>
            <PageNavigation
              prevLink={`${chapterBaseURL}${prevChapter && prevChapter.id}`}
              nextLink={`${chapterBaseURL}${nextChapter && nextChapter.id}`}
              disablePrev={!prevChapter}
              disableNext={!nextChapter}
            />
            <div style={{ textAlign: 'center' }}>
              <Typography variant="h4">
                {mangaTitle}
              </Typography>
              <br />
              <Typography variant="h6">
                Chapter {chapterNumber} {title && ` - ${title}`}
              </Typography>
              {scanlatorNames && (
                <Typography variant="subtitle1">
                  Scanlated by {scanlatorNames}
                </Typography>
              )}
            </div>
            {imagesLoading && (
              <Box m={4}>
                <Typography variant="body2" color="textSecondary" align="center">
                  Loading images...
              </Typography>
                <Box display="flex" alignItems="center">
                  <Box width="100%" m={2}>
                    <LinearProgress
                      variant="determinate"
                      value={imagesLoaded / chapterPages.length * 100}
                    />
                  </Box>
                  <Box minWidth={35}>
                    <Typography variant="body2" color="textSecondary">
                      {imagesLoaded + '/' + chapterPages.length}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )}
            <List>
              {pagesToDisplay}
            </List>
            <ChapterList chapters={allChapters} selectedChapter={chapterId} />
            <br />
            <PageNavigation
              topOfPage={false}
              prevLink={`${chapterBaseURL}${prevChapter && prevChapter.id}`}
              nextLink={`${chapterBaseURL}${nextChapter && nextChapter.id}`}
              disablePrev={!prevChapter}
              disableNext={!nextChapter}
            />
          </Grid>
          <Grid item xs="auto" sm={1} md={4} />
        </Grid>
      </>
    );
  }
};

const mapDispatchToProps = (dispatch) => ({
  setReading: (mangaInfo, chapterInfo) => dispatch(setReading(mangaInfo, chapterInfo))
});

export default connect(undefined, mapDispatchToProps)(ReadChapterPage);