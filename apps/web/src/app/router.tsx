import { createBrowserRouter } from 'react-router'
import { AppShell } from './AppShell.tsx'
import { SubjectTheme } from '../components/SubjectTheme.tsx'
import { NotFound } from '../routes/NotFound.tsx'
import { SignIn } from '../routes/auth/SignIn.tsx'
import { SignUp } from '../routes/auth/SignUp.tsx'
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
import { ParentHome } from '../routes/parent/ParentHome.tsx'
import { StudentSummary } from '../routes/parent/StudentSummary.tsx'
import { StudentMap } from '../routes/parent/StudentMap.tsx'
import { TutorDashboard } from '../routes/tutor/TutorDashboard.tsx'
import { TutorStudent } from '../routes/tutor/TutorStudent.tsx'

/**
 * URL structure. Student screens live at the root; parent and tutor areas are
 * prefixed. Subject routes are wrapped in SubjectTheme so the accent follows the URL.
 */
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <NotFound />,
    children: [
      { index: true, element: <Home /> },
      { path: 'subjects', element: <Subjects /> },
      {
        path: 'subjects/:subjectId',
        element: (
          <SubjectTheme>
            <TopicMap />
          </SubjectTheme>
        ),
      },
      { path: 'subjects/:subjectId/exam-technique', element: <SubjectTheme><ExamTechnique /></SubjectTheme> },
      { path: 'subjects/:subjectId/topics/:topicId', element: <SubjectTheme><Topic /></SubjectTheme> },
      { path: 'subjects/:subjectId/topics/:topicId/lesson', element: <SubjectTheme><Lesson /></SubjectTheme> },
      { path: 'subjects/:subjectId/topics/:topicId/quiz', element: <SubjectTheme><Quiz /></SubjectTheme> },
      { path: 'subjects/:subjectId/topics/:topicId/worksheet/:level', element: <SubjectTheme><Worksheet /></SubjectTheme> },
      { path: 'progress', element: <Progress /> },
      { path: 'settings', element: <Settings /> },

      { path: 'parent', element: <ParentHome /> },
      { path: 'parent/:studentId', element: <StudentSummary /> },
      { path: 'parent/:studentId/map', element: <StudentMap /> },

      { path: 'tutor', element: <TutorDashboard /> },
      { path: 'tutor/students/:studentId', element: <TutorStudent /> },

      { path: 'sign-in', element: <SignIn /> },
      { path: 'sign-up', element: <SignUp /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
