function App() {
  return (
    <main className="sticky">
      <header className="sticky__titlebar" data-tauri-drag-region>
        <span data-tauri-drag-region>Petari</span>
      </header>

      <section className="sticky__content">
        <h1>Petari</h1>
        <p>Markdown stickies for your desktop.</p>
      </section>
    </main>
  );
}

export default App;
