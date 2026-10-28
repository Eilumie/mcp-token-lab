// Discover default templates from JSON files, including nested directories.
export default import.meta.glob('./**/*.json', { eager: true, import: 'default' });
