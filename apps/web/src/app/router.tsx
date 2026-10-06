import { createBrowserRouter } from 'react-router'
import { AppShell } from './AppShell.tsx'
import { SubjectTheme } from '../components/SubjectTheme.tsx'
import { NotFound } from '../routes/NotFound.tsx'
import { Home } from '../routes/student/Home.tsx'
import { Subjects } from '../routes/student/Subjects.tsx'
import { TopicMap } from '../routes/student/TopicMap.tsx'
import { Progress } from '../routes/student/Progress.tsx'
import { Settings } from '../routes/student/Settings.tsx'
import { screen } from './screens.ts'

// Fetched when first opened; see screens.ts for which screens and why.
const study = () => import('../routes/study.ts')
const lookup = () => import('../routes/lookup.ts')
const reference = () => import('../routes/reference.ts')
const Topic = screen(study, 'Topic')
const Lesson = screen(study, 'Lesson')
const Quiz = screen(study, 'Quiz')
const Worksheet = screen(study, 'Worksheet')
const WorksheetPrint = screen(study, 'WorksheetPrint')
const ExamTechnique = screen(study, 'ExamTechnique')
const WhyItExists = screen(study, 'WhyItExists')
const Flashcards = screen(study, 'Flashcards')
const CheatSheet = screen(study, 'CheatSheet')
const Mistakes = screen(study, 'Mistakes')
const Recap = screen(study, 'Recap')
const Glossary = screen(lookup, 'Glossary')
const Search = screen(lookup, 'Search')
const Resources = screen(reference, 'Resources')
const ResourcePage = screen(reference, 'ResourcePage')
const Family = screen(() => import('../routes/parent/Family.tsx'), 'Family')

/**
 * URL structure. Every screen is the student's own except /family, which is a parent
 * reading their child's account. Subject routes are wrapped in SubjectTheme so the
 * accent follows the URL.
 */
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <NotFound />,
    children: [
      { index: true, element: <Home /> },
      { path: 'subjects', element: <Subjects /> },
      { path: 'subjects/:subjectId', element: <SubjectTheme><TopicMap /></SubjectTheme> },
      { path: 'subjects/:subjectId/exam-technique', element: <SubjectTheme><ExamTechnique /></SubjectTheme> },
      { path: 'subjects/:subjectId/topics/:topicId', element: <SubjectTheme><Topic /></SubjectTheme> },
      { path: 'subjects/:subjectId/topics/:topicId/why', element: <SubjectTheme><WhyItExists /></SubjectTheme> },
      { path: 'subjects/:subjectId/topics/:topicId/lesson', element: <SubjectTheme><Lesson /></SubjectTheme> },
      { path: 'subjects/:subjectId/topics/:topicId/quiz', element: <SubjectTheme><Quiz /></SubjectTheme> },
      { path: 'subjects/:subjectId/topics/:topicId/worksheet/:level', element: <SubjectTheme><Worksheet /></SubjectTheme> },
      { path: 'subjects/:subjectId/topics/:topicId/worksheet/:level/print', element: <SubjectTheme><WorksheetPrint /></SubjectTheme> },
      { path: 'subjects/:subjectId/topics/:topicId/flashcards', element: <SubjectTheme><Flashcards /></SubjectTheme> },
      { path: 'subjects/:subjectId/topics/:topicId/cheatsheet', element: <SubjectTheme><CheatSheet /></SubjectTheme> },
      { path: 'search', element: <Search /> },
      { path: 'glossary', element: <Glossary /> },
      { path: 'resources', element: <Resources /> },
      { path: 'resources/:subjectId/:resourceId', element: <SubjectTheme><ResourcePage /></SubjectTheme> },
      { path: 'progress', element: <Progress /> },
      { path: 'mistakes', element: <Mistakes /> },
      { path: 'recap', element: <Recap /> },
      { path: 'family', element: <Family /> },
      { path: 'settings', element: <Settings /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
