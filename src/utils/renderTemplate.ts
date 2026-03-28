const sampleData: Record<string, string> = {
  '{{first_name}}': 'Vinay',
  '{{last_name}}': 'Challa',
  '{{full_name}}': 'Vinay Challa',
  '{{company_name}}': 'Averitas',
  '{{title}}': 'Founder',
}

export function renderTemplate(template: string): string {
  let rendered = template

  Object.entries(sampleData).forEach(([key, value]) => {
    rendered = rendered.replaceAll(key, value)
  })

  return rendered
}
