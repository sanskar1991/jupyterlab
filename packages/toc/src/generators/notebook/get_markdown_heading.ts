// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { Cell } from '@jupyterlab/cells';
import { INotebookHeading } from '../../utils/headings';
import { generateNumbering } from '../../utils/generate_numbering';
import { parseHeading } from '../../utils/parse_heading';

/**
 * Returns a "click" handler.
 *
 * @private
 * @param line - line number
 * @returns "click" handler
 */
type onClickFactory = (line: number) => () => void;

/**
 * Parses a Markdown string and returns a notebook heading.
 *
 * @private
 * @param text - Markdown string
 * @param onClick - callback which returns a "click" handler
 * @param dict - numbering dictionary
 * @param lastLevel - last level
 * @param cellRef - cell reference
 * @returns notebook heading
 */
function getMarkdownHeadings(
  text: string,
  onClick: onClickFactory,
  dict: any,
  lastLevel: number,
  cellRef: Cell
): INotebookHeading[] {
  const clbk = onClick(0);
  let headings: INotebookHeading[] = [];
  for (const line of text.split('\n')) {
    const heading = parseHeading(line);
    if (heading) {
      headings.push({
        text: heading.text,
        level: heading.level,
        numbering: generateNumbering(dict, heading.level),
        onClick: clbk,
        type: 'header',
        cellRef: cellRef,
        hasChild: false
      });
    } else {
      headings.push({
        text: text,
        level: lastLevel + 1,
        onClick: clbk,
        type: 'markdown',
        cellRef: cellRef,
        hasChild: false
      });
    }
  }
  return headings;
}

/**
 * Exports.
 */
export { getMarkdownHeadings };
