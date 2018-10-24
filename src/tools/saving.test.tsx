import * as saving from './saving';

it("creates a new project without crashing", () => {
    const project = saving.newProject();
});

it("serialises then deserialises a project to the same thing", () =>
{
    const project = saving.newProject();
    const json = saving.projectToJson(project);
    const copy = saving.jsonToProject(json);

    expect(copy).toEqual(project);
});

