import {
  readFileSync,
  WriteFileOptions,
  writeFileSync,
  statSync,
  existsSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
  unlinkSync,
  rmdirSync,
} from 'fs'
import { dirname, extname, join, resolve, basename } from 'path'
import { grey, bold } from 'colors/safe'
export type ProduciblePath = string | PathController
export type Optional<T> = T | null
export type FSOptions =
  | {
      encoding?: BufferEncoding
      flag?: string | undefined
      absolutePath?: boolean
    }
  | BufferEncoding

export class PathController {
  readonly path: string
  readonly exists: boolean = false
  readonly isDirectory: boolean = false
  readonly isFile: boolean = false

  constructor(path?: string) {
    this.path = path || ''
    this.exists = existsSync(this.path)
    if (this.exists) {
      const stat = statSync(this.path)
      this.isDirectory = stat.isDirectory()
      this.isFile = stat.isFile()
    }
  }

  get suffix(): string {
    return extname(this.path)
  }

  get suffixWithout(): string {
    return this.suffix.slice(1)
  }

  get abspath(): string {
    return resolve(this.path)
  }

  get logpath(): string {
    const dirML = 80
    const s =
      this.abspath.length - this.basename.length <= dirML
        ? this.abspath
        : this.abspath.slice(0, dirML) + '...' + this.basename
    return bold(grey(s))
  }

  get dirname(): string {
    if (this.isDirectory) return this.abspath
    if (this.isFile) return dirname(this.abspath)
    return null
  }

  get basename(): string {
    return basename(this.abspath)
  }

  get basenameWithout(): string {
    return basename(this.abspath, this.suffix)
  }

  read(options?: FSOptions): Buffer | string | Array<Buffer | string> {
    if (this.isDirectory) {
      const isAbs = options && options['absolutePath']
      options && delete options['absolutePath']
      const list = readdirSync(this.path, options)
      return isAbs ? list.map((t) => resolve(this.abspath, t)) : list
    } else if (this.isFile) return readFileSync(this.path, options)
    else return null
  }

  write(data: string | NodeJS.ArrayBufferView, options?: WriteFileOptions): this {
    writeFileSync(this.abspath, data, options)
    return this
  }

  copy(_target: ProduciblePath): PathController {
    // copy single path
    const target = PathController.make(_target)
    if (this.isFile) return copyFileSync(this.path, target.mkdir().abspath), this
    // deep copy multiple directory
    if (this.isDirectory) {
      target.mkdir(true)
      this.deepListDir().forEach((t) => {
        const _tp = PathController.make(join(target.abspath, t.replace(this.abspath, '')))
        copyFileSync(t, _tp.mkdir().abspath)
      })
      return this
    }
    return this
  }

  move(_target: ProduciblePath): PathController {
    this.copy(_target).abspath
    if (this.isFile) unlinkSync(this.abspath)
    else if (this.isDirectory) rmdirSync(this.abspath, { recursive: true })
    return PathController.make(_target)
  }

  mkdir(self?: boolean): Optional<PathController> {
    if (this.exists) return this
    const _path = self ? this.path : dirname(this.path)
    mkdirSync(_path, { recursive: true })
    return this
  }

  deepListDir(): Optional<string[]> {
    if (!this.isDirectory) return null
    const list: string[] = []

    function listFile(dir) {
      readdirSync(dir).forEach(function (item) {
        const fullPath = join(dir, item)
        statSync(fullPath).isDirectory() ? listFile(fullPath) : list.push(fullPath)
      })
      return list
    }

    listFile(this.abspath)
    return list
  }

  join(...paths: string[]): PathController {
    return PathController.make(join(this.abspath, ...paths))
  }

  static make(path?: ProduciblePath): PathController {
    path = path || ''
    return path instanceof PathController ? path : new PathController(path)
  }
}

export function isProduciblePath(value: unknown): value is ProduciblePath {
  return typeof value === 'string' || value instanceof PathController
}