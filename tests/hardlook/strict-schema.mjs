import assert from 'node:assert/strict';

export function validateStrictSchema(rule) {
  const types = Array.isArray(rule.type) ? rule.type : [rule.type];
  assert.ok(types.every((type) => ['object', 'array', 'string', 'integer', 'null'].includes(type)));
  if (types.includes('object')) {
    assert.equal(rule.additionalProperties, false);
    assert.deepEqual([...rule.required].sort(), Object.keys(rule.properties).sort());
    for (const child of Object.values(rule.properties)) validateStrictSchema(child);
  }
  if (types.includes('array')) validateStrictSchema(rule.items);
}

export function validateSchemaValue(value, rule) {
  const type =
    value === null
      ? 'null'
      : Array.isArray(value)
        ? 'array'
        : Number.isInteger(value)
          ? 'integer'
          : typeof value;
  assert.ok((Array.isArray(rule.type) ? rule.type : [rule.type]).includes(type));
  if (rule.enum) assert.ok(rule.enum.includes(value));
  if (type === 'string') assert.ok(value.length >= (rule.minLength ?? 0));
  if (type === 'integer') assert.ok(value >= (rule.minimum ?? -Infinity));
  if (type === 'array') value.forEach((item) => validateSchemaValue(item, rule.items));
  if (type === 'object') {
    for (const key of rule.required) assert.ok(Object.hasOwn(value, key));
    for (const [key, child] of Object.entries(value)) {
      assert.ok(Object.hasOwn(rule.properties, key));
      validateSchemaValue(child, rule.properties[key]);
    }
  }
}
