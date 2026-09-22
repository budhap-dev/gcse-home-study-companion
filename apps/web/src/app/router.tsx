import { createBrowserRouter } from 'react-router'
import { AppShell } from './AppShell.tsx'
import { SubjectTheme } from '../components/SubjectTheme.tsx'
import { NotFound } from '../routes/NotFound.tsx'
import { Home } from '../routes/student/Home.tsx'
import { Subjects } from '../routes/student/Subjects.tsx'
import { TopicMap } from '../routes/student/TopicMap.tsx'
import { Topic } from '../routes/student/Topic.tsx'
import { Lesson } from '../routes/student/Lesson.tsx'
import { Quiz } from '../routes/student/Quiz.tsx'
import { Worksheet } from '../routes/student/Worksheet.tsx'
import { WorksheetPrint } from '../routes/student/WorksheetPrint.tsx'
import { ExamTechnique } from '../routes/student/ExamTechnique.tsx'
import { WhyItExists } from '../routes/student/WhyItExists.tsx'
import { Progress } from '../routes/student/Progress.tsx'
import { Settings } from '../routes/student/Settings.tsx'
import { Flashcards } from '../routes/student/Flashcards.tsx'
import { CheatSheet } from '../routes/student/CheatSheet.tsx'
import { Search } from '../routes/student/Search.tsx'
import { Glossary } from '../routes/student/Glossary.tsx'
import { Family } from '../routes/parent/Family.tsx'

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
      { path: 'progress', element: <Progress /> },
      { path: 'family', element: <Family /> },
      { path: 'settings', element: <Settings /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
