#!/usr/bin/env python3
"""Combine multiple GPX files into a single GPX file with one <trk> per input file.

Usage:
    python combine_gpx.py -o combined.gpx *.gpx
    python combine_gpx.py -o combined.gpx track1.gpx track2.gpx track3.gpx

Each input file's filename (without directory) is stored as <name> inside its <trk>.
"""

import argparse
import os
import xml.etree.ElementTree as ET

GPX_NS = "http://www.topografix.com/GPX/1/1"
ET.register_namespace("", GPX_NS)


def parse_tracks(filepath):
    """Yield all <trk> elements from a GPX file, setting <name> to the filename."""
    tree = ET.parse(filepath)
    root = tree.getroot()

    # Detect namespace from root tag (GPX 1.0 has none, 1.1 has the standard one)
    if root.tag.startswith("{"):
        ns_uri = root.tag[1:root.tag.index("}")]
    else:
        ns_uri = ""

    def nstag(local):
        return f"{{{ns_uri}}}{local}" if ns_uri else local

    name = os.path.splitext(os.path.basename(filepath))[0]

    for trk in root.iter(nstag("trk")):
        name_el = trk.find(nstag("name"))
        if name_el is None:
            name_el = ET.SubElement(trk, nstag("name"))
        name_el.text = name
        yield trk


def combine(input_files, output_file):
    root = ET.Element(f"{{{GPX_NS}}}gpx", version="1.1", creator="combine_gpx.py")
    count = 0

    for filepath in input_files:
        for trk in parse_tracks(filepath):
            root.append(trk)
            count += 1

    tree = ET.ElementTree(root)
    ET.indent(tree, space="  ")
    tree.write(output_file, xml_declaration=True, encoding="UTF-8")
    print(f"Wrote {count} tracks from {len(input_files)} files to {output_file}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Combine GPX files into one.")
    parser.add_argument("files", nargs="+", help="Input GPX files")
    parser.add_argument("-o", "--output", default="combined.gpx", help="Output file (default: combined.gpx)")
    args = parser.parse_args()
    combine(args.files, args.output)
