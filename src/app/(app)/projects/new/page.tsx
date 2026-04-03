import { CreateWizard } from '@/components/wizard/create-wizard'

export const metadata = {
  title: 'New Project — KernelCanvas',
  description: 'Create a Linux kernel API schema from natural language.',
}

export default function NewProjectPage() {
  return (
    <div className="container max-w-4xl mx-auto py-8">
      <CreateWizard />
    </div>
  )
}
