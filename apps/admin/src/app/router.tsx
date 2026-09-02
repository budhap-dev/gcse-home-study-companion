import { createBrowserRouter } from 'react-router'
import { AppShell } from './AppShell.tsx'
import { Topics } from '../routes/Topics.tsx'
import { TopicEditor } from '../routes/TopicEditor.tsx'
import { QuestionBank } from '../routes/QuestionBank.tsx'
import { Import } from '../routes/Import.tsx'
import { Reports } from '../routes/Reports.tsx'
import { Draft } from '../routes/Draft.tsx'

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Topics /> },
      { path: 'topics/:topicId', element: <TopicEditor /> },
      { path: 'draft', element: <Draft /> },
      { path: 'questions', element: <QuestionBank /> },
      { path: 'import', element: <Import /> },
      { path: 'reports', element: <Reports /> },
    ],
  },
])
