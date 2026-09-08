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
import { ExamTechnique } from '../routes/student/ExamTechnique.tsx'
import { Progress } from '../routes/student/Progress.tsx'
import { Settings } from '../routes/student/Settings.tsx'

/**
 * URL structure. No accounts: every screen is for the student using this device.
 * Subject routes are wrapped in SubjectTheme so the accent follows the URL.
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
      { path: 'subjects/:subjectId/topics/:topicId/lesson', element: <SubjectTheme><Lesson /></SubjectTheme> },
      { path: 'subjects/:subjectId/topics/:topicId/quiz', element: <SubjectTheme><Quiz /></SubjectTheme> },
      { path: 'subjects/:subjectId/topics/:topicId/worksheet/:level', element: <SubjectTheme><Worksheet /></SubjectTheme> },
      { path: 'progress', element: <Progress /> },
      { path: 'settings', element: <Settings /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
