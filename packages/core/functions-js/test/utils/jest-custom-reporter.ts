// TODO: replace with a working implementation
export function attach(name: string, content: string | Buffer, type: any): void {
  // getAllure().step(name, () => {
  //   getAllure().attachment(type.toString(), content, type)
  // })
}

export function log(name: string, description?: string): void {
  console.info(description ? `${name}: ${description}` : name)
}
