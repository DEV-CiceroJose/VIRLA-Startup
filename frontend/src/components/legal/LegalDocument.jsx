/** Renderiza um documento legal (Termos/Política) a partir de pages/Legal/documents.js. */
export default function LegalDocument({ doc, headingLevel = 2, idPrefix = doc.slug }) {
  const Heading = `h${headingLevel}`
  return (
    <div className="vl-doc">
      <p className="vl-intro">{doc.intro}</p>
      {doc.sections.map((section, index) => (
        <section key={section.title} id={`${idPrefix}-${index + 1}`} className="vl-section">
          <Heading>{section.title}</Heading>
          {section.p?.map((text) => <p key={text}>{text}</p>)}
          {section.list && (
            <ul>
              {section.list.map((text) => <li key={text}>{text}</li>)}
            </ul>
          )}
          {section.note && <p className="vl-note">{section.note}</p>}
        </section>
      ))}
    </div>
  )
}
