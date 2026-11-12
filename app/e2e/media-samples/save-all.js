// Sample code for an Unvibe demo. Not from a real project.

async function saveAll(items, save) {
  items.forEach(async (item) => {
    await save(item);
  });
  console.log("all saved");
}
