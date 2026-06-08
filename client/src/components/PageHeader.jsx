export default function PageHeader({ title, description, action }) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="bbx-section-title page-title">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-bbx-muted">{description}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
