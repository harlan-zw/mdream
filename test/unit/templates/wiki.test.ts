import { describe, expect, it } from 'vitest'
import { syncHtmlToMarkdown } from '../../../src'

describe('tables', () => {
  it('headings', () => {
    const html = `<div class="mw-heading mw-heading2"><h2 id="Conventions">Conventions</h2><span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a href="/w/index.php?title=List_of_chiropterans&amp;action=edit&amp;section=1" title="Edit section: Conventions"><span>edit</span></a><span class="mw-editsection-bracket">]</span></span></div>`
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toMatchInlineSnapshot(`
      "## Conventions

      [[edit](/w/index.php?title=List_of_chiropterans&amp;action=edit&amp;section=1)]"
    `)
  })
  it('wikipedia', () => {
    const html = `<table class="wikitable" style="width:100%;text-align:center">
<caption style="background-color: #BBBBFF">Subfamily <b><a href="/wiki/Emballonurinae" class="mw-redirect" title="Emballonurinae">Emballonurinae</a></b> – <small><a href="/wiki/Paul_Gervais" title="Paul Gervais">Gervais</a>, 1856</small> – twelve genera
</caption>
<tbody><tr>
<th scope="col" style="width:18%; min-width:180px;">Name
</th>
<th scope="col" style="width:25%; min-width:180px;">Authority and species
</th>
<th scope="col" style="width:18%; min-width:180px;">Range
</th>
<th scope="col" style="width:39%; min-width:180px;">Size and ecology
</th></tr>
<tr>
<th scope="row"><i><a href="/wiki/Balantiopteryx" title="Balantiopteryx">Balantiopteryx</a></i><br>(sac-winged bat)
<p><span typeof="mw:File"><a href="/wiki/File:Gray_Sac-winged_Bat_(Balantiopteryx_plicata)_(24776812271).jpg" class="mw-file-description"><img alt="Brown bat" src="//upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Gray_Sac-winged_Bat_%28Balantiopteryx_plicata%29_%2824776812271%29.jpg/250px-Gray_Sac-winged_Bat_%28Balantiopteryx_plicata%29_%2824776812271%29.jpg" decoding="async" width="180" height="120" class="mw-file-element" srcset="//upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Gray_Sac-winged_Bat_%28Balantiopteryx_plicata%29_%2824776812271%29.jpg/330px-Gray_Sac-winged_Bat_%28Balantiopteryx_plicata%29_%2824776812271%29.jpg 1.5x, //upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Gray_Sac-winged_Bat_%28Balantiopteryx_plicata%29_%2824776812271%29.jpg/500px-Gray_Sac-winged_Bat_%28Balantiopteryx_plicata%29_%2824776812271%29.jpg 2x" data-file-width="3120" data-file-height="2088"></a></span>
</p>
</th>
<td><a href="/wiki/Wilhelm_Peters" title="Wilhelm Peters">Peters</a>, 1867
<br><br><small><div class="collapsible-list mw-collapsible mw-made-collapsible" style="text-align: left;"><button type="button" class="mw-collapsible-toggle mw-collapsible-toggle-default" aria-expanded="true" tabindex="0"><span class="mw-collapsible-text">hide</span></button>
<div style="line-height: 1.6em; font-weight: bold;"><div>Three species</div></div>
<ul class="mw-collapsible-content" style="margin-top: 0; margin-bottom: 0; line-height: inherit;"><li style="line-height: inherit; margin: 0"> <i>B. infusca</i> (<a href="/wiki/Ecuadorian_sac-winged_bat" title="Ecuadorian sac-winged bat">Ecuadorian sac-winged bat</a>)
</li><li style="line-height: inherit; margin: 0"> <i>B. io</i> (<a href="/wiki/Thomas%27s_sac-winged_bat" title="Thomas's sac-winged bat">Thomas's sac-winged bat</a>)
</li><li style="line-height: inherit; margin: 0"> <i>B. plicata</i> (<a href="/wiki/Gray_sac-winged_bat" title="Gray sac-winged bat">Gray sac-winged bat</a>, pictured)
</li></ul>
</div></small>
</td>
<td>Mexico, Central America, and northwestern South America
</td>
<td style="text-align:left;"><i>Size range</i>: 3&nbsp;cm (1&nbsp;in) long, plus 1&nbsp;cm (0.4&nbsp;in) tail (Ecuadorian sac-winged bat) to 6&nbsp;cm (2&nbsp;in) long, plus 3&nbsp;cm (1&nbsp;in) tail (gray sac-winged bat)<sup id="cite_ref-EmballonuridaeSize_6-0" class="reference"><a href="#cite_note-EmballonuridaeSize-6"><span class="cite-bracket">[</span>6<span class="cite-bracket">]</span></a></sup><br><br><i>Habitats</i>: Caves, shrubland, and forest<sup id="cite_ref-BalantiopteryxHabitat_7-0" class="reference"><a href="#cite_note-BalantiopteryxHabitat-7"><span class="cite-bracket">[</span>7<span class="cite-bracket">]</span></a></sup>
</td></tr>
<tr>
<th scope="row"><i><a href="/wiki/Centronycteris" title="Centronycteris">Centronycteris</a></i><br>(shaggy bat)
<p><span typeof="mw:File"><a href="/wiki/File:Centronycteris_centralis_31737818.jpg" class="mw-file-description"><img alt="Brown bat" src="//upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Centronycteris_centralis_31737818.jpg/250px-Centronycteris_centralis_31737818.jpg" decoding="async" width="180" height="135" class="mw-file-element" srcset="//upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Centronycteris_centralis_31737818.jpg/330px-Centronycteris_centralis_31737818.jpg 1.5x, //upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Centronycteris_centralis_31737818.jpg/500px-Centronycteris_centralis_31737818.jpg 2x" data-file-width="2048" data-file-height="1536"></a></span>
</p>
</th>
<td><a href="/wiki/John_Edward_Gray" title="John Edward Gray">Gray</a>, 1838
<br><br><small><div class="collapsible-list mw-collapsible mw-made-collapsible" style="text-align: left;"><button type="button" class="mw-collapsible-toggle mw-collapsible-toggle-default" aria-expanded="true" tabindex="0"><span class="mw-collapsible-text">hide</span></button>
<div style="line-height: 1.6em; font-weight: bold;"><div>Two species</div></div>
<ul class="mw-collapsible-content" style="margin-top: 0; margin-bottom: 0; line-height: inherit;"><li style="line-height: inherit; margin: 0"> <i>C. centralis</i> (<a href="/wiki/Thomas%27s_shaggy_bat" title="Thomas's shaggy bat">Thomas's shaggy bat</a>, pictured)
</li><li style="line-height: inherit; margin: 0"> <i>C. maximiliani</i> (<a href="/wiki/Shaggy_bat" title="Shaggy bat">Shaggy bat</a>)
</li></ul>
</div></small>
</td>
<td>Mexico, Central America, and northern and eastern South America
</td>
<td style="text-align:left;"><i>Size range</i>: 4&nbsp;cm (2&nbsp;in) long, plus 1&nbsp;cm (0.4&nbsp;in) tail (Thomas's shaggy bat) to 7&nbsp;cm (3&nbsp;in) long, plus 3&nbsp;cm (1&nbsp;in) tail (shaggy bat)<sup id="cite_ref-EmballonuridaeSize_6-1" class="reference"><a href="#cite_note-EmballonuridaeSize-6"><span class="cite-bracket">[</span>6<span class="cite-bracket">]</span></a></sup><br><br><i>Habitat</i>: Forest<sup id="cite_ref-CentronycterisHabitat_8-0" class="reference"><a href="#cite_note-CentronycterisHabitat-8"><span class="cite-bracket">[</span>8<span class="cite-bracket">]</span></a></sup>
</td></tr>
<tr>
<th scope="row"><i><a href="/wiki/Coleura" title="Coleura">Coleura</a></i><br>(sheath-tailed bat)
<p><span typeof="mw:File"><a href="/wiki/File:Coleura_afra_2021.jpg" class="mw-file-description"><img alt="Brown bat head" src="//upload.wikimedia.org/wikipedia/commons/thumb/5/51/Coleura_afra_2021.jpg/250px-Coleura_afra_2021.jpg" decoding="async" width="140" height="140" class="mw-file-element" srcset="//upload.wikimedia.org/wikipedia/commons/thumb/5/51/Coleura_afra_2021.jpg/330px-Coleura_afra_2021.jpg 2x" data-file-width="814" data-file-height="814"></a></span>
</p>
</th>
<td><a href="/wiki/Wilhelm_Peters" title="Wilhelm Peters">Peters</a>, 1867
<br><br><small><div class="collapsible-list mw-collapsible mw-made-collapsible" style="text-align: left;"><button type="button" class="mw-collapsible-toggle mw-collapsible-toggle-default" aria-expanded="true" tabindex="0"><span class="mw-collapsible-text">hide</span></button>
<div style="line-height: 1.6em; font-weight: bold;"><div>Three species</div></div>
<ul class="mw-collapsible-content" style="margin-top: 0; margin-bottom: 0; line-height: inherit;"><li style="line-height: inherit; margin: 0"> <i>C. afra</i> (<a href="/wiki/African_sheath-tailed_bat" title="African sheath-tailed bat">African sheath-tailed bat</a>, pictured)
</li><li style="line-height: inherit; margin: 0"> <i>C. kibomalandy</i> (<a href="/wiki/Madagascar_sheath-tailed_bat" title="Madagascar sheath-tailed bat">Madagascar sheath-tailed bat</a>)
</li><li style="line-height: inherit; margin: 0"> <i>C. seychellensis</i> (<a href="/wiki/Seychelles_sheath-tailed_bat" title="Seychelles sheath-tailed bat">Seychelles sheath-tailed bat</a>)
</li></ul>
</div></small>
</td>
<td>Africa
</td>
<td style="text-align:left;"><i>Size range</i>: 5–7&nbsp;cm (2–3&nbsp;in) long, plus 1–2&nbsp;cm (0.4–0.8&nbsp;in) tail (multiple)<sup id="cite_ref-EmballonuridaeSize_6-2" class="reference"><a href="#cite_note-EmballonuridaeSize-6"><span class="cite-bracket">[</span>6<span class="cite-bracket">]</span></a></sup><br><br><i>Habitats</i>: Shrubland, forest, caves, savanna, inland wetlands, and desert<sup id="cite_ref-ColeuraHabitat_9-0" class="reference"><a href="#cite_note-ColeuraHabitat-9"><span class="cite-bracket">[</span>9<span class="cite-bracket">]</span></a></sup>
</td></tr>
<tr>
<th scope="row"><i><a href="/wiki/Cormura" class="mw-redirect" title="Cormura">Cormura</a></i>
<p><span typeof="mw:File"><a href="/wiki/File:Naturalis_Biodiversity_Center_-_RMNH.MAM.24346.b_ven_-_Cormura_brevirostris_-_skin.jpeg" class="mw-file-description"><img alt="Brown bat" src="//upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Naturalis_Biodiversity_Center_-_RMNH.MAM.24346.b_ven_-_Cormura_brevirostris_-_skin.jpeg/250px-Naturalis_Biodiversity_Center_-_RMNH.MAM.24346.b_ven_-_Cormura_brevirostris_-_skin.jpeg" decoding="async" width="180" height="120" class="mw-file-element" srcset="//upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Naturalis_Biodiversity_Center_-_RMNH.MAM.24346.b_ven_-_Cormura_brevirostris_-_skin.jpeg/330px-Naturalis_Biodiversity_Center_-_RMNH.MAM.24346.b_ven_-_Cormura_brevirostris_-_skin.jpeg 1.5x, //upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Naturalis_Biodiversity_Center_-_RMNH.MAM.24346.b_ven_-_Cormura_brevirostris_-_skin.jpeg/500px-Naturalis_Biodiversity_Center_-_RMNH.MAM.24346.b_ven_-_Cormura_brevirostris_-_skin.jpeg 2x" data-file-width="1920" data-file-height="1275"></a></span>
</p>
</th>
<td><a href="/wiki/Wilhelm_Peters" title="Wilhelm Peters">Peters</a>, 1867
<br><br><small><div class="collapsible-list mw-collapsible mw-made-collapsible" style="text-align: left;"><button type="button" class="mw-collapsible-toggle mw-collapsible-toggle-default" aria-expanded="true" tabindex="0"><span class="mw-collapsible-text">hide</span></button>
<div style="line-height: 1.6em; font-weight: bold;"><div>One species</div></div>
<ul class="mw-collapsible-content" style="margin-top: 0; margin-bottom: 0; line-height: inherit;"><li style="line-height: inherit; margin: 0"> <i>C. brevirostris</i> (<a href="/wiki/Chestnut_sac-winged_bat" title="Chestnut sac-winged bat">Chestnut sac-winged bat</a>)
</li></ul>
</div></small>
</td>
<td>Central America and northern South America<br><span typeof="mw:File"><a href="/wiki/File:Chestnut_Sac-Winged_Bat_area.png" class="mw-file-description"><img alt="Map of range" src="//upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Chestnut_Sac-Winged_Bat_area.png/120px-Chestnut_Sac-Winged_Bat_area.png" decoding="async" width="112" height="140" class="mw-file-element" srcset="//upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Chestnut_Sac-Winged_Bat_area.png/250px-Chestnut_Sac-Winged_Bat_area.png 1.5x" data-file-width="326" data-file-height="407"></a></span>
</td>
<td style="text-align:left;"><i>Size</i>: 4–6&nbsp;cm (2–2&nbsp;in) long, plus 1–2&nbsp;cm (0.4–0.8&nbsp;in) tail<sup id="cite_ref-EmballonuridaeSize_6-3" class="reference"><a href="#cite_note-EmballonuridaeSize-6"><span class="cite-bracket">[</span>6<span class="cite-bracket">]</span></a></sup><br><br><i>Habitat</i>: Forest<sup id="cite_ref-IUCNChestnutsac-wingedbat_10-0" class="reference"><a href="#cite_note-IUCNChestnutsac-wingedbat-10"><span class="cite-bracket">[</span>10<span class="cite-bracket">]</span></a></sup>
</td></tr>
<tr>
<th scope="row"><i><a href="/wiki/Cyttarops" class="mw-redirect" title="Cyttarops">Cyttarops</a></i>
</th>
<td><a href="/wiki/Oldfield_Thomas" title="Oldfield Thomas">Thomas</a>, 1913
<br><br><small><div class="collapsible-list mw-collapsible mw-made-collapsible" style="text-align: left;"><button type="button" class="mw-collapsible-toggle mw-collapsible-toggle-default" aria-expanded="true" tabindex="0"><span class="mw-collapsible-text">hide</span></button>
<div style="line-height: 1.6em; font-weight: bold;"><div>One species</div></div>
<ul class="mw-collapsible-content" style="margin-top: 0; margin-bottom: 0; line-height: inherit;"><li style="line-height: inherit; margin: 0"> <i>C. alecto</i> (<a href="/wiki/Short-eared_bat" title="Short-eared bat">Short-eared bat</a>)
</li></ul>
</div></small>
</td>
<td>Central America and northern South America<br><span typeof="mw:File"><a href="/wiki/File:Short-eared_Bat_area.png" class="mw-file-description"><img alt="Map of range" src="//upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Short-eared_Bat_area.png/120px-Short-eared_Bat_area.png" decoding="async" width="112" height="140" class="mw-file-element" srcset="//upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Short-eared_Bat_area.png/250px-Short-eared_Bat_area.png 1.5x" data-file-width="326" data-file-height="407"></a></span>
</td>
<td style="text-align:left;"><i>Size</i>: 4–6&nbsp;cm (2–2&nbsp;in) long, plus 2–3&nbsp;cm (1–1&nbsp;in) tail<sup id="cite_ref-EmballonuridaeSize_6-4" class="reference"><a href="#cite_note-EmballonuridaeSize-6"><span class="cite-bracket">[</span>6<span class="cite-bracket">]</span></a></sup><br><br><i>Habitat</i>: Forest<sup id="cite_ref-IUCNShort-earedbat_11-0" class="reference"><a href="#cite_note-IUCNShort-earedbat-11"><span class="cite-bracket">[</span>11<span class="cite-bracket">]</span></a></sup>
</td></tr>
<tr>
<th scope="row"><i><a href="/wiki/Diclidurus" title="Diclidurus">Diclidurus</a></i><br>(ghost bat)
<p><span typeof="mw:File"><a href="/wiki/File:P1070111-Northern-Ghost-Bat-(diclidurus-albus).jpg" class="mw-file-description"><img alt="White bat" src="//upload.wikimedia.org/wikipedia/commons/thumb/9/9b/P1070111-Northern-Ghost-Bat-%28diclidurus-albus%29.jpg/250px-P1070111-Northern-Ghost-Bat-%28diclidurus-albus%29.jpg" decoding="async" width="140" height="140" class="mw-file-element" srcset="//upload.wikimedia.org/wikipedia/commons/thumb/9/9b/P1070111-Northern-Ghost-Bat-%28diclidurus-albus%29.jpg/330px-P1070111-Northern-Ghost-Bat-%28diclidurus-albus%29.jpg 2x" data-file-width="1968" data-file-height="1968"></a></span>
</p>
</th>
<td><a href="/wiki/Prince_Maximilian_of_Wied-Neuwied" title="Prince Maximilian of Wied-Neuwied">Wied-Neuwied</a>, 1820
<br><br><small><div class="collapsible-list mw-collapsible mw-made-collapsible" style="text-align: left;"><button type="button" class="mw-collapsible-toggle mw-collapsible-toggle-default" aria-expanded="true" tabindex="0"><span class="mw-collapsible-text">hide</span></button>
<div style="line-height: 1.6em; font-weight: bold;"><div>Four species</div></div>
<ul class="mw-collapsible-content" style="margin-top: 0; margin-bottom: 0; line-height: inherit;"><li style="line-height: inherit; margin: 0"> <i>D. albus</i> (<a href="/wiki/Northern_ghost_bat" title="Northern ghost bat">Northern ghost bat</a>, pictured)
</li><li style="line-height: inherit; margin: 0"> <i>D. ingens</i> (<a href="/wiki/Greater_ghost_bat" title="Greater ghost bat">Greater ghost bat</a>)
</li><li style="line-height: inherit; margin: 0"> <i>D. isabellus</i> (<a href="/wiki/Isabelle%27s_ghost_bat" title="Isabelle's ghost bat">Isabelle's ghost bat</a>)
</li><li style="line-height: inherit; margin: 0"> <i>D. scutatus</i> (<a href="/wiki/Lesser_ghost_bat" title="Lesser ghost bat">Lesser ghost bat</a>)
</li></ul>
</div></small>
</td>
<td>Mexico, Central America, and South America
</td>
<td style="text-align:left;"><i>Size range</i>: 5&nbsp;cm (2&nbsp;in) long, plus 1&nbsp;cm (0.4&nbsp;in) tail (lesser ghost bat) to 9&nbsp;cm (4&nbsp;in) long, plus 8&nbsp;cm (3&nbsp;in) tail (northern ghost bat)<sup id="cite_ref-EmballonuridaeSize_6-5" class="reference"><a href="#cite_note-EmballonuridaeSize-6"><span class="cite-bracket">[</span>6<span class="cite-bracket">]</span></a></sup><br><br><i>Habitat</i>: Forest<sup id="cite_ref-DiclidurusHabitat_12-0" class="reference"><a href="#cite_note-DiclidurusHabitat-12"><span class="cite-bracket">[</span>12<span class="cite-bracket">]</span></a></sup>
</td></tr>
<tr>
<th scope="row"><i><a href="/wiki/Emballonura" title="Emballonura">Emballonura</a></i><br>(sheath-tailed bat)
<p><span typeof="mw:File"><a href="/wiki/File:Emballonura_semicaudata,_Ovalau_Island_-_Joanne_Malotaux_(22057146275).jpg" class="mw-file-description"><img alt="Brown bat" src="//upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Emballonura_semicaudata%2C_Ovalau_Island_-_Joanne_Malotaux_%2822057146275%29.jpg/250px-Emballonura_semicaudata%2C_Ovalau_Island_-_Joanne_Malotaux_%2822057146275%29.jpg" decoding="async" width="180" height="135" class="mw-file-element" srcset="//upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Emballonura_semicaudata%2C_Ovalau_Island_-_Joanne_Malotaux_%2822057146275%29.jpg/330px-Emballonura_semicaudata%2C_Ovalau_Island_-_Joanne_Malotaux_%2822057146275%29.jpg 1.5x, //upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Emballonura_semicaudata%2C_Ovalau_Island_-_Joanne_Malotaux_%2822057146275%29.jpg/500px-Emballonura_semicaudata%2C_Ovalau_Island_-_Joanne_Malotaux_%2822057146275%29.jpg 2x" data-file-width="4320" data-file-height="3240"></a></span>
</p>
</th>
<td><a href="/wiki/Coenraad_Jacob_Temminck" title="Coenraad Jacob Temminck">Temminck</a>, 1838
<br><br><small><div class="collapsible-list mw-collapsible mw-collapsed mw-made-collapsible" style="text-align: left;"><button type="button" class="mw-collapsible-toggle mw-collapsible-toggle-default mw-collapsible-toggle-collapsed" aria-expanded="false" tabindex="0"><span class="mw-collapsible-text">show</span></button>
<div style="line-height: 1.6em; font-weight: bold;"><div>Eight species</div></div>
<ul class="mw-collapsible-content" style="margin-top: 0px; margin-bottom: 0px; line-height: inherit; display: none;"><li style="line-height: inherit; margin: 0"> <i>E. alecto</i> (<a href="/wiki/Small_Asian_sheath-tailed_bat" title="Small Asian sheath-tailed bat">Small Asian sheath-tailed bat</a>)
</li><li style="line-height: inherit; margin: 0"> <i>E. beccarii</i> (<a href="/wiki/Beccari%27s_sheath-tailed_bat" title="Beccari's sheath-tailed bat">Beccari's sheath-tailed bat</a>)
</li><li style="line-height: inherit; margin: 0"> <i>E. dianae</i> (<a href="/wiki/Large-eared_sheath-tailed_bat" title="Large-eared sheath-tailed bat">Large-eared sheath-tailed bat</a>)
</li><li style="line-height: inherit; margin: 0"> <i>E. furax</i> (<a href="/wiki/Greater_sheath-tailed_bat" title="Greater sheath-tailed bat">Greater sheath-tailed bat</a>)
</li><li style="line-height: inherit; margin: 0"> <i>E. monticola</i> (<a href="/wiki/Lesser_sheath-tailed_bat" title="Lesser sheath-tailed bat">Lesser sheath-tailed bat</a>)
</li><li style="line-height: inherit; margin: 0"> <i>E. raffrayana</i> (<a href="/wiki/Raffray%27s_sheath-tailed_bat" title="Raffray's sheath-tailed bat">Raffray's sheath-tailed bat</a>)
</li><li style="line-height: inherit; margin: 0"> <i>E. semicaudata</i> (<a href="/wiki/Pacific_sheath-tailed_bat" title="Pacific sheath-tailed bat">Pacific sheath-tailed bat</a>, pictured)
</li><li style="line-height: inherit; margin: 0"> <i>E. serii</i> (<a href="/wiki/Seri%27s_sheath-tailed_bat" title="Seri's sheath-tailed bat">Seri's sheath-tailed bat</a>)
</li></ul>
</div></small>
</td>
<td>Southeastern Asia
</td>
<td style="text-align:left;"><i>Size range</i>: 3&nbsp;cm (1&nbsp;in) long, plus 1&nbsp;cm (0.4&nbsp;in) tail (Beccari's sheath-tailed bat) to 7&nbsp;cm (3&nbsp;in) long, plus 2&nbsp;cm (1&nbsp;in) tail (greater sheath-tailed bat)<sup id="cite_ref-EmballonuridaeSize_6-6" class="reference"><a href="#cite_note-EmballonuridaeSize-6"><span class="cite-bracket">[</span>6<span class="cite-bracket">]</span></a></sup><br><br><i>Habitats</i>: Rocky areas, caves, and forest<sup id="cite_ref-EmballonuraHabitat_13-0" class="reference"><a href="#cite_note-EmballonuraHabitat-13"><span class="cite-bracket">[</span>13<span class="cite-bracket">]</span></a></sup>
</td></tr>
<tr>
<th scope="row"><i><a href="/wiki/Mosia" class="mw-redirect" title="Mosia">Mosia</a></i>
<p><span typeof="mw:File"><a href="/wiki/File:Dark_Sheath-tailed_Bat_imported_from_iNaturalist_photo_451989042_on_2_December_2024.jpg" class="mw-file-description"><img alt="Brown bats" src="//upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Dark_Sheath-tailed_Bat_imported_from_iNaturalist_photo_451989042_on_2_December_2024.jpg/250px-Dark_Sheath-tailed_Bat_imported_from_iNaturalist_photo_451989042_on_2_December_2024.jpg" decoding="async" width="180" height="120" class="mw-file-element" srcset="//upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Dark_Sheath-tailed_Bat_imported_from_iNaturalist_photo_451989042_on_2_December_2024.jpg/330px-Dark_Sheath-tailed_Bat_imported_from_iNaturalist_photo_451989042_on_2_December_2024.jpg 1.5x, //upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Dark_Sheath-tailed_Bat_imported_from_iNaturalist_photo_451989042_on_2_December_2024.jpg/500px-Dark_Sheath-tailed_Bat_imported_from_iNaturalist_photo_451989042_on_2_December_2024.jpg 2x" data-file-width="2048" data-file-height="1366"></a></span>
</p>
</th>
<td><a href="/wiki/John_Edward_Gray" title="John Edward Gray">Gray</a>, 1843
<br><br><small><div class="collapsible-list mw-collapsible mw-made-collapsible" style="text-align: left;"><button type="button" class="mw-collapsible-toggle mw-collapsible-toggle-default" aria-expanded="true" tabindex="0"><span class="mw-collapsible-text">hide</span></button>
<div style="line-height: 1.6em; font-weight: bold;"><div>One species</div></div>
<ul class="mw-collapsible-content" style="margin-top: 0; margin-bottom: 0; line-height: inherit;"><li style="line-height: inherit; margin: 0"> <i>M. nigrescens</i> (<a href="/wiki/Dark_sheath-tailed_bat" title="Dark sheath-tailed bat">Dark sheath-tailed bat</a>)
</li></ul>
</div></small>
</td>
<td>Indonesia, Papua New Guinea, and the Solomon Islands<br><span typeof="mw:File"><a href="/wiki/File:Mosia_nigrescens_distribution.png" class="mw-file-description"><img alt="Map of range" src="//upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Mosia_nigrescens_distribution.png/250px-Mosia_nigrescens_distribution.png" decoding="async" width="180" height="135" class="mw-file-element" srcset="//upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Mosia_nigrescens_distribution.png/330px-Mosia_nigrescens_distribution.png 1.5x, //upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Mosia_nigrescens_distribution.png/500px-Mosia_nigrescens_distribution.png 2x" data-file-width="1259" data-file-height="944"></a></span>
</td>
<td style="text-align:left;"><i>Size</i>: 3–5&nbsp;cm (1–2&nbsp;in) long, plus 1–2&nbsp;cm (0.4–0.8&nbsp;in) tail<sup id="cite_ref-EmballonuridaeSize_6-7" class="reference"><a href="#cite_note-EmballonuridaeSize-6"><span class="cite-bracket">[</span>6<span class="cite-bracket">]</span></a></sup><br><br><i>Habitats</i>: Forest, rocky areas, and caves<sup id="cite_ref-IUCNDarksheath-tailedbat_14-0" class="reference"><a href="#cite_note-IUCNDarksheath-tailedbat-14"><span class="cite-bracket">[</span>14<span class="cite-bracket">]</span></a></sup>
</td></tr>
<tr>
<th scope="row"><i><a href="/wiki/Paremballonura" title="Paremballonura">Paremballonura</a></i><br>(false sheath-tailed bat)
<p><span typeof="mw:File"><a href="/wiki/File:Paremballonura_atrata.jpg" class="mw-file-description"><img alt="Brown bat" src="//upload.wikimedia.org/wikipedia/commons/thumb/9/98/Paremballonura_atrata.jpg/250px-Paremballonura_atrata.jpg" decoding="async" width="140" height="128" class="mw-file-element" srcset="//upload.wikimedia.org/wikipedia/commons/thumb/9/98/Paremballonura_atrata.jpg/330px-Paremballonura_atrata.jpg 2x" data-file-width="1496" data-file-height="1373"></a></span>
</p>
</th>
<td><a href="/wiki/Steven_M._Goodman" title="Steven M. Goodman">Goodman</a>, <a href="/w/index.php?title=S%C3%A9bastien_J._Puechmaille&amp;action=edit&amp;redlink=1" class="new" title="Sébastien J. Puechmaille (page does not exist)">Puechmaille</a>, <a href="/w/index.php?title=Nicole_Friedli-Weyeneth&amp;action=edit&amp;redlink=1" class="new" title="Nicole Friedli-Weyeneth (page does not exist)">Friedli-Weyeneth</a>, <a href="/wiki/Justin_Gerlach" title="Justin Gerlach">Gerlach</a>, <a href="/w/index.php?title=Manuel_Ruedi&amp;action=edit&amp;redlink=1" class="new" title="Manuel Ruedi (page does not exist)">Ruedi</a>, <a href="/w/index.php?title=M._Corrie_Schoeman&amp;action=edit&amp;redlink=1" class="new" title="M. Corrie Schoeman (page does not exist)">Schoeman</a>, <a href="/wiki/Bill_Stanley_(mammalogist)" title="Bill Stanley (mammalogist)">Stanley</a>, &amp; <a href="/wiki/Emma_Teeling" title="Emma Teeling">Teeling</a>, 2012
<br><br><small><div class="collapsible-list mw-collapsible mw-made-collapsible" style="text-align: left;"><button type="button" class="mw-collapsible-toggle mw-collapsible-toggle-default" aria-expanded="true" tabindex="0"><span class="mw-collapsible-text">hide</span></button>
<div style="line-height: 1.6em; font-weight: bold;"><div>Two species</div></div>
<ul class="mw-collapsible-content" style="margin-top: 0; margin-bottom: 0; line-height: inherit;"><li style="line-height: inherit; margin: 0"> <i>P. atrata</i> (<a href="/wiki/Peters%27s_sheath-tailed_bat" title="Peters's sheath-tailed bat">Peters's sheath-tailed bat</a>)
</li><li style="line-height: inherit; margin: 0"> <i>P. tiavato</i> (<a href="/wiki/Western_sheath-tailed_bat" title="Western sheath-tailed bat">Western sheath-tailed bat</a>)
</li></ul>
</div></small>
</td>
<td>Madagascar
</td>
<td style="text-align:left;"><i>Size range</i>: 4–5&nbsp;cm (2&nbsp;in), plus 1–2&nbsp;cm (0.4–0.8&nbsp;in) tail (multiple)<sup id="cite_ref-EmballonuridaeSize_6-8" class="reference"><a href="#cite_note-EmballonuridaeSize-6"><span class="cite-bracket">[</span>6<span class="cite-bracket">]</span></a></sup><br><br><i>Habitats</i>: Caves and forest<sup id="cite_ref-ParemballonuraHabitat_15-0" class="reference"><a href="#cite_note-ParemballonuraHabitat-15"><span class="cite-bracket">[</span>15<span class="cite-bracket">]</span></a></sup>
</td></tr>
<tr>
<th scope="row"><i><a href="/wiki/Peropteryx" title="Peropteryx">Peropteryx</a></i><br>(dog-like bat)
<p><span typeof="mw:File"><a href="/wiki/File:Lesser_Dog-like_Bat_imported_from_iNaturalist_photo_129124225_on_2_December_2024.jpg" class="mw-file-description"><img alt="Brown bat" src="//upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Lesser_Dog-like_Bat_imported_from_iNaturalist_photo_129124225_on_2_December_2024.jpg/250px-Lesser_Dog-like_Bat_imported_from_iNaturalist_photo_129124225_on_2_December_2024.jpg" decoding="async" width="180" height="120" class="mw-file-element" srcset="//upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Lesser_Dog-like_Bat_imported_from_iNaturalist_photo_129124225_on_2_December_2024.jpg/330px-Lesser_Dog-like_Bat_imported_from_iNaturalist_photo_129124225_on_2_December_2024.jpg 1.5x, //upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Lesser_Dog-like_Bat_imported_from_iNaturalist_photo_129124225_on_2_December_2024.jpg/500px-Lesser_Dog-like_Bat_imported_from_iNaturalist_photo_129124225_on_2_December_2024.jpg 2x" data-file-width="1620" data-file-height="1080"></a></span>
</p>
</th>
<td><a href="/wiki/Wilhelm_Peters" title="Wilhelm Peters">Peters</a>, 1867
<br><br><small><div class="collapsible-list mw-collapsible mw-made-collapsible" style="text-align: left;"><button type="button" class="mw-collapsible-toggle mw-collapsible-toggle-default" aria-expanded="true" tabindex="0"><span class="mw-collapsible-text">hide</span></button>
<div style="line-height: 1.6em; font-weight: bold;"><div>Five species</div></div>
<ul class="mw-collapsible-content" style="margin-top: 0; margin-bottom: 0; line-height: inherit;"><li style="line-height: inherit; margin: 0"> <i>P. kappleri</i> (<a href="/wiki/Greater_dog-like_bat" title="Greater dog-like bat">Greater dog-like bat</a>)
</li><li style="line-height: inherit; margin: 0"> <i>P. leucoptera</i> (<a href="/wiki/White-winged_dog-like_bat" title="White-winged dog-like bat">White-winged dog-like bat</a>)
</li><li style="line-height: inherit; margin: 0"> <i>P. macrotis</i> (<a href="/wiki/Lesser_dog-like_bat" title="Lesser dog-like bat">Lesser dog-like bat</a>, pictured)
</li><li style="line-height: inherit; margin: 0"> <i>P. pallidoptera</i> (<a href="/wiki/Pale-winged_dog-like_bat" title="Pale-winged dog-like bat">Pale-winged dog-like bat</a>)
</li><li style="line-height: inherit; margin: 0"> <i>P. trinitatis</i> (<a href="/wiki/Trinidad_dog-like_bat" title="Trinidad dog-like bat">Trinidad dog-like bat</a>)
</li></ul>
</div></small>
</td>
<td>Mexico, Central America, and South America
</td>
<td style="text-align:left;"><i>Size range</i>: 4&nbsp;cm (2&nbsp;in) long, plus 1&nbsp;cm (0.4&nbsp;in) tail (lesser dog-like bat) to 8&nbsp;cm (3&nbsp;in) long, plus 2&nbsp;cm (1&nbsp;in) tail (greater dog-like bat)<sup id="cite_ref-EmballonuridaeSize_6-9" class="reference"><a href="#cite_note-EmballonuridaeSize-6"><span class="cite-bracket">[</span>6<span class="cite-bracket">]</span></a></sup><br><br><i>Habitats</i>: Caves, shrubland, and forest<sup id="cite_ref-PeropteryxHabitat_16-0" class="reference"><a href="#cite_note-PeropteryxHabitat-16"><span class="cite-bracket">[</span>16<span class="cite-bracket">]</span></a></sup>
</td></tr>
<tr>
<th scope="row"><i><a href="/wiki/Rhynchonycteris" class="mw-redirect" title="Rhynchonycteris">Rhynchonycteris</a></i>
<p><span typeof="mw:File"><a href="/wiki/File:Long-nosed_proboscis_bats.JPG" class="mw-file-description"><img alt="Brown bats" src="//upload.wikimedia.org/wikipedia/commons/thumb/0/09/Long-nosed_proboscis_bats.JPG/250px-Long-nosed_proboscis_bats.JPG" decoding="async" width="180" height="120" class="mw-file-element" srcset="//upload.wikimedia.org/wikipedia/commons/thumb/0/09/Long-nosed_proboscis_bats.JPG/330px-Long-nosed_proboscis_bats.JPG 1.5x, //upload.wikimedia.org/wikipedia/commons/thumb/0/09/Long-nosed_proboscis_bats.JPG/500px-Long-nosed_proboscis_bats.JPG 2x" data-file-width="4272" data-file-height="2848"></a></span>
</p>
</th>
<td><a href="/wiki/Wilhelm_Peters" title="Wilhelm Peters">Peters</a>, 1867
<br><br><small><div class="collapsible-list mw-collapsible mw-made-collapsible" style="text-align: left;"><button type="button" class="mw-collapsible-toggle mw-collapsible-toggle-default" aria-expanded="true" tabindex="0"><span class="mw-collapsible-text">hide</span></button>
<div style="line-height: 1.6em; font-weight: bold;"><div>One species</div></div>
<ul class="mw-collapsible-content" style="margin-top: 0; margin-bottom: 0; line-height: inherit;"><li style="line-height: inherit; margin: 0"> <i>R. naso</i> (<a href="/wiki/Proboscis_bat" title="Proboscis bat">Proboscis bat</a>)
</li></ul>
</div></small>
</td>
<td>Mexico, Central America, and South America<br><span typeof="mw:File"><a href="/wiki/File:Proboscis_Bat_area.png" class="mw-file-description"><img alt="Map of range" src="//upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Proboscis_Bat_area.png/120px-Proboscis_Bat_area.png" decoding="async" width="112" height="140" class="mw-file-element" srcset="//upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Proboscis_Bat_area.png/250px-Proboscis_Bat_area.png 1.5x" data-file-width="326" data-file-height="407"></a></span>
</td>
<td style="text-align:left;"><i>Size</i>: 3–5&nbsp;cm (1–2&nbsp;in) long, plus 1–2&nbsp;cm (0.4–0.8&nbsp;in) tail<sup id="cite_ref-EmballonuridaeSize_6-10" class="reference"><a href="#cite_note-EmballonuridaeSize-6"><span class="cite-bracket">[</span>6<span class="cite-bracket">]</span></a></sup><br><br><i>Habitats</i>: Forest and caves<sup id="cite_ref-IUCNProboscisbat_17-0" class="reference"><a href="#cite_note-IUCNProboscisbat-17"><span class="cite-bracket">[</span>17<span class="cite-bracket">]</span></a></sup>
</td></tr>
<tr>
<th scope="row"><i><a href="/wiki/Saccopteryx" title="Saccopteryx">Saccopteryx</a></i><br>(sac-winged bat)
<p><span typeof="mw:File"><a href="/wiki/File:Frosted_Sac-winged_Bat_imported_from_iNaturalist_photo_17543865_on_2_December_2024.jpg" class="mw-file-description"><img alt="Brown bats" src="//upload.wikimedia.org/wikipedia/commons/thumb/7/70/Frosted_Sac-winged_Bat_imported_from_iNaturalist_photo_17543865_on_2_December_2024.jpg/250px-Frosted_Sac-winged_Bat_imported_from_iNaturalist_photo_17543865_on_2_December_2024.jpg" decoding="async" width="180" height="135" class="mw-file-element" srcset="//upload.wikimedia.org/wikipedia/commons/thumb/7/70/Frosted_Sac-winged_Bat_imported_from_iNaturalist_photo_17543865_on_2_December_2024.jpg/330px-Frosted_Sac-winged_Bat_imported_from_iNaturalist_photo_17543865_on_2_December_2024.jpg 1.5x, //upload.wikimedia.org/wikipedia/commons/thumb/7/70/Frosted_Sac-winged_Bat_imported_from_iNaturalist_photo_17543865_on_2_December_2024.jpg/500px-Frosted_Sac-winged_Bat_imported_from_iNaturalist_photo_17543865_on_2_December_2024.jpg 2x" data-file-width="2048" data-file-height="1536"></a></span>
</p>
</th>
<td><a href="/wiki/Johann_Karl_Wilhelm_Illiger" title="Johann Karl Wilhelm Illiger">Illiger</a>, 1811
<br><br><small><div class="collapsible-list mw-collapsible mw-made-collapsible" style="text-align: left;"><button type="button" class="mw-collapsible-toggle mw-collapsible-toggle-default" aria-expanded="true" tabindex="0"><span class="mw-collapsible-text">hide</span></button>
<div style="line-height: 1.6em; font-weight: bold;"><div>Five species</div></div>
<ul class="mw-collapsible-content" style="margin-top: 0; margin-bottom: 0; line-height: inherit;"><li style="line-height: inherit; margin: 0"> <i>S. antioquensis</i> (<a href="/wiki/Antioquian_sac-winged_bat" title="Antioquian sac-winged bat">Antioquian sac-winged bat</a>)
</li><li style="line-height: inherit; margin: 0"> <i>S. bilineata</i> (<a href="/wiki/Greater_sac-winged_bat" title="Greater sac-winged bat">Greater sac-winged bat</a>)
</li><li style="line-height: inherit; margin: 0"> <i>S. canescens</i> (<a href="/wiki/Frosted_sac-winged_bat" title="Frosted sac-winged bat">Frosted sac-winged bat</a>, pictured)
</li><li style="line-height: inherit; margin: 0"> <i>S. gymnura</i> (<a href="/wiki/Amazonian_sac-winged_bat" title="Amazonian sac-winged bat">Amazonian sac-winged bat</a>)
</li><li style="line-height: inherit; margin: 0"> <i>S. leptura</i> (<a href="/wiki/Lesser_sac-winged_bat" title="Lesser sac-winged bat">Lesser sac-winged bat</a>)
</li></ul>
</div></small>
</td>
<td>Mexico, Central America, and South America
</td>
<td style="text-align:left;"><i>Size range</i>: 3&nbsp;cm (1&nbsp;in) long, plus 1&nbsp;cm (0.4&nbsp;in) tail (Amazonian sac-winged bat) to 6&nbsp;cm (2&nbsp;in) long, plus 3&nbsp;cm (1&nbsp;in) tail (greater sac-winged bat)<sup id="cite_ref-EmballonuridaeSize_6-11" class="reference"><a href="#cite_note-EmballonuridaeSize-6"><span class="cite-bracket">[</span>6<span class="cite-bracket">]</span></a></sup><br><br><i>Habitats</i>: Caves and forest<sup id="cite_ref-SaccopteryxHabitat_18-0" class="reference"><a href="#cite_note-SaccopteryxHabitat-18"><span class="cite-bracket">[</span>18<span class="cite-bracket">]</span></a></sup>
</td></tr></tbody></table>`

    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toMatchInlineSnapshot(`
      "Subfamily **[Emballonurinae](/wiki/Emballonurinae)** – [Gervais](/wiki/Paul_Gervais), 1856 – twelve genera

      | Name | Authority and species | Range | Size and ecology |
      | --- | --- | --- | --- |
      | *[Balantiopteryx](/wiki/Balantiopteryx)*(sac-winged bat) [![Brown bat](https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Gray_Sac-winged_Bat_%28Balantiopteryx_plicata%29_%2824776812271%29.jpg/250px-Gray_Sac-winged_Bat_%28Balantiopteryx_plicata%29_%2824776812271%29.jpg)](/wiki/File:Gray_Sac-winged_Bat_(Balantiopteryx_plicata)_(24776812271).jpg) | [Peters](/wiki/Wilhelm_Peters), 1867 <br><br>hide Three species <ul><li>*B. infusca* ([Ecuadorian sac-winged bat](/wiki/Ecuadorian_sac-winged_bat))</li><li>*B. io* ([Thomas's sac-winged bat](/wiki/Thomas%27s_sac-winged_bat))</li><li>*B. plicata* ([Gray sac-winged bat](/wiki/Gray_sac-winged_bat), pictured)</li></ul> | Mexico, Central America, and northwestern South America | *Size range*: 3 cm (1 in) long, plus 1 cm (0.4 in) tail (Ecuadorian sac-winged bat) to 6 cm (2 in) long, plus 3 cm (1 in) tail (gray sac-winged bat)<sup>[\\[6\\]](#cite_note-EmballonuridaeSize-6)</sup><br><br>*Habitats*: Caves, shrubland, and forest<sup>[\\[7\\]](#cite_note-BalantiopteryxHabitat-7)</sup> |
      | *[Centronycteris](/wiki/Centronycteris)*(shaggy bat) [![Brown bat](https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Centronycteris_centralis_31737818.jpg/250px-Centronycteris_centralis_31737818.jpg)](/wiki/File:Centronycteris_centralis_31737818.jpg) | [Gray](/wiki/John_Edward_Gray), 1838 <br><br>hide Two species <ul><li>*C. centralis* ([Thomas's shaggy bat](/wiki/Thomas%27s_shaggy_bat), pictured)</li><li>*C. maximiliani* ([Shaggy bat](/wiki/Shaggy_bat))</li></ul> | Mexico, Central America, and northern and eastern South America | *Size range*: 4 cm (2 in) long, plus 1 cm (0.4 in) tail (Thomas's shaggy bat) to 7 cm (3 in) long, plus 3 cm (1 in) tail (shaggy bat)<sup>[\\[6\\]](#cite_note-EmballonuridaeSize-6)</sup><br><br>*Habitat*: Forest<sup>[\\[8\\]](#cite_note-CentronycterisHabitat-8)</sup> |
      | *[Coleura](/wiki/Coleura)*(sheath-tailed bat) [![Brown bat head](https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Coleura_afra_2021.jpg/250px-Coleura_afra_2021.jpg)](/wiki/File:Coleura_afra_2021.jpg) | [Peters](/wiki/Wilhelm_Peters), 1867 <br><br>hide Three species <ul><li>*C. afra* ([African sheath-tailed bat](/wiki/African_sheath-tailed_bat), pictured)</li><li>*C. kibomalandy* ([Madagascar sheath-tailed bat](/wiki/Madagascar_sheath-tailed_bat))</li><li>*C. seychellensis* ([Seychelles sheath-tailed bat](/wiki/Seychelles_sheath-tailed_bat))</li></ul> | Africa | *Size range*: 5–7 cm (2–3 in) long, plus 1–2 cm (0.4–0.8 in) tail (multiple)<sup>[\\[6\\]](#cite_note-EmballonuridaeSize-6)</sup><br><br>*Habitats*: Shrubland, forest, caves, savanna, inland wetlands, and desert<sup>[\\[9\\]](#cite_note-ColeuraHabitat-9)</sup> |
      | *[Cormura](/wiki/Cormura)* [![Brown bat](https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Naturalis_Biodiversity_Center_-_RMNH.MAM.24346.b_ven_-_Cormura_brevirostris_-_skin.jpeg/250px-Naturalis_Biodiversity_Center_-_RMNH.MAM.24346.b_ven_-_Cormura_brevirostris_-_skin.jpeg)](/wiki/File:Naturalis_Biodiversity_Center_-_RMNH.MAM.24346.b_ven_-_Cormura_brevirostris_-_skin.jpeg) | [Peters](/wiki/Wilhelm_Peters), 1867 <br><br>hide One species <ul><li>*C. brevirostris* ([Chestnut sac-winged bat](/wiki/Chestnut_sac-winged_bat))</li></ul> | Central America and northern South America<br>[![Map of range](https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Chestnut_Sac-Winged_Bat_area.png/120px-Chestnut_Sac-Winged_Bat_area.png)](/wiki/File:Chestnut_Sac-Winged_Bat_area.png) | *Size*: 4–6 cm (2–2 in) long, plus 1–2 cm (0.4–0.8 in) tail<sup>[\\[6\\]](#cite_note-EmballonuridaeSize-6)</sup><br><br>*Habitat*: Forest<sup>[\\[10\\]](#cite_note-IUCNChestnutsac-wingedbat-10)</sup> |
      | *[Cyttarops](/wiki/Cyttarops)* | [Thomas](/wiki/Oldfield_Thomas), 1913 <br><br>hide One species <ul><li>*C. alecto* ([Short-eared bat](/wiki/Short-eared_bat))</li></ul> | Central America and northern South America<br>[![Map of range](https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Short-eared_Bat_area.png/120px-Short-eared_Bat_area.png)](/wiki/File:Short-eared_Bat_area.png) | *Size*: 4–6 cm (2–2 in) long, plus 2–3 cm (1–1 in) tail<sup>[\\[6\\]](#cite_note-EmballonuridaeSize-6)</sup><br><br>*Habitat*: Forest<sup>[\\[11\\]](#cite_note-IUCNShort-earedbat-11)</sup> |
      | *[Diclidurus](/wiki/Diclidurus)*(ghost bat) [![White bat](https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/P1070111-Northern-Ghost-Bat-%28diclidurus-albus%29.jpg/250px-P1070111-Northern-Ghost-Bat-%28diclidurus-albus%29.jpg)](/wiki/File:P1070111-Northern-Ghost-Bat-(diclidurus-albus).jpg) | [Wied-Neuwied](/wiki/Prince_Maximilian_of_Wied-Neuwied), 1820 <br><br>hide Four species <ul><li>*D. albus* ([Northern ghost bat](/wiki/Northern_ghost_bat), pictured)</li><li>*D. ingens* ([Greater ghost bat](/wiki/Greater_ghost_bat))</li><li>*D. isabellus* ([Isabelle's ghost bat](/wiki/Isabelle%27s_ghost_bat))</li><li>*D. scutatus* ([Lesser ghost bat](/wiki/Lesser_ghost_bat))</li></ul> | Mexico, Central America, and South America | *Size range*: 5 cm (2 in) long, plus 1 cm (0.4 in) tail (lesser ghost bat) to 9 cm (4 in) long, plus 8 cm (3 in) tail (northern ghost bat)<sup>[\\[6\\]](#cite_note-EmballonuridaeSize-6)</sup><br><br>*Habitat*: Forest<sup>[\\[12\\]](#cite_note-DiclidurusHabitat-12)</sup> |
      | *[Emballonura](/wiki/Emballonura)*(sheath-tailed bat) [![Brown bat](https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Emballonura_semicaudata%2C_Ovalau_Island_-_Joanne_Malotaux_%2822057146275%29.jpg/250px-Emballonura_semicaudata%2C_Ovalau_Island_-_Joanne_Malotaux_%2822057146275%29.jpg)](/wiki/File:Emballonura_semicaudata,_Ovalau_Island_-_Joanne_Malotaux_(22057146275).jpg) | [Temminck](/wiki/Coenraad_Jacob_Temminck), 1838 <br><br>show Eight species <ul><li>*E. alecto* ([Small Asian sheath-tailed bat](/wiki/Small_Asian_sheath-tailed_bat))</li><li>*E. beccarii* ([Beccari's sheath-tailed bat](/wiki/Beccari%27s_sheath-tailed_bat))</li><li>*E. dianae* ([Large-eared sheath-tailed bat](/wiki/Large-eared_sheath-tailed_bat))</li><li>*E. furax* ([Greater sheath-tailed bat](/wiki/Greater_sheath-tailed_bat))</li><li>*E. monticola* ([Lesser sheath-tailed bat](/wiki/Lesser_sheath-tailed_bat))</li><li>*E. raffrayana* ([Raffray's sheath-tailed bat](/wiki/Raffray%27s_sheath-tailed_bat))</li><li>*E. semicaudata* ([Pacific sheath-tailed bat](/wiki/Pacific_sheath-tailed_bat), pictured)</li><li>*E. serii* ([Seri's sheath-tailed bat](/wiki/Seri%27s_sheath-tailed_bat))</li></ul> | Southeastern Asia | *Size range*: 3 cm (1 in) long, plus 1 cm (0.4 in) tail (Beccari's sheath-tailed bat) to 7 cm (3 in) long, plus 2 cm (1 in) tail (greater sheath-tailed bat)<sup>[\\[6\\]](#cite_note-EmballonuridaeSize-6)</sup><br><br>*Habitats*: Rocky areas, caves, and forest<sup>[\\[13\\]](#cite_note-EmballonuraHabitat-13)</sup> |
      | *[Mosia](/wiki/Mosia)* [![Brown bats](https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Dark_Sheath-tailed_Bat_imported_from_iNaturalist_photo_451989042_on_2_December_2024.jpg/250px-Dark_Sheath-tailed_Bat_imported_from_iNaturalist_photo_451989042_on_2_December_2024.jpg)](/wiki/File:Dark_Sheath-tailed_Bat_imported_from_iNaturalist_photo_451989042_on_2_December_2024.jpg) | [Gray](/wiki/John_Edward_Gray), 1843 <br><br>hide One species <ul><li>*M. nigrescens* ([Dark sheath-tailed bat](/wiki/Dark_sheath-tailed_bat))</li></ul> | Indonesia, Papua New Guinea, and the Solomon Islands<br>[![Map of range](https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Mosia_nigrescens_distribution.png/250px-Mosia_nigrescens_distribution.png)](/wiki/File:Mosia_nigrescens_distribution.png) | *Size*: 3–5 cm (1–2 in) long, plus 1–2 cm (0.4–0.8 in) tail<sup>[\\[6\\]](#cite_note-EmballonuridaeSize-6)</sup><br><br>*Habitats*: Forest, rocky areas, and caves<sup>[\\[14\\]](#cite_note-IUCNDarksheath-tailedbat-14)</sup> |
      | *[Paremballonura](/wiki/Paremballonura)*(false sheath-tailed bat) [![Brown bat](https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Paremballonura_atrata.jpg/250px-Paremballonura_atrata.jpg)](/wiki/File:Paremballonura_atrata.jpg) | [Goodman](/wiki/Steven_M._Goodman), [Puechmaille](/w/index.php?title=S%C3%A9bastien_J._Puechmaille&amp;action=edit&amp;redlink=1), [Friedli-Weyeneth](/w/index.php?title=Nicole_Friedli-Weyeneth&amp;action=edit&amp;redlink=1), [Gerlach](/wiki/Justin_Gerlach), [Ruedi](/w/index.php?title=Manuel_Ruedi&amp;action=edit&amp;redlink=1), [Schoeman](/w/index.php?title=M._Corrie_Schoeman&amp;action=edit&amp;redlink=1), [Stanley](/wiki/Bill_Stanley_(mammalogist)), & [Teeling](/wiki/Emma_Teeling), 2012 <br><br>hide Two species <ul><li>*P. atrata* ([Peters's sheath-tailed bat](/wiki/Peters%27s_sheath-tailed_bat))</li><li>*P. tiavato* ([Western sheath-tailed bat](/wiki/Western_sheath-tailed_bat))</li></ul> | Madagascar | *Size range*: 4–5 cm (2 in), plus 1–2 cm (0.4–0.8 in) tail (multiple)<sup>[\\[6\\]](#cite_note-EmballonuridaeSize-6)</sup><br><br>*Habitats*: Caves and forest<sup>[\\[15\\]](#cite_note-ParemballonuraHabitat-15)</sup> |
      | *[Peropteryx](/wiki/Peropteryx)*(dog-like bat) [![Brown bat](https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Lesser_Dog-like_Bat_imported_from_iNaturalist_photo_129124225_on_2_December_2024.jpg/250px-Lesser_Dog-like_Bat_imported_from_iNaturalist_photo_129124225_on_2_December_2024.jpg)](/wiki/File:Lesser_Dog-like_Bat_imported_from_iNaturalist_photo_129124225_on_2_December_2024.jpg) | [Peters](/wiki/Wilhelm_Peters), 1867 <br><br>hide Five species <ul><li>*P. kappleri* ([Greater dog-like bat](/wiki/Greater_dog-like_bat))</li><li>*P. leucoptera* ([White-winged dog-like bat](/wiki/White-winged_dog-like_bat))</li><li>*P. macrotis* ([Lesser dog-like bat](/wiki/Lesser_dog-like_bat), pictured)</li><li>*P. pallidoptera* ([Pale-winged dog-like bat](/wiki/Pale-winged_dog-like_bat))</li><li>*P. trinitatis* ([Trinidad dog-like bat](/wiki/Trinidad_dog-like_bat))</li></ul> | Mexico, Central America, and South America | *Size range*: 4 cm (2 in) long, plus 1 cm (0.4 in) tail (lesser dog-like bat) to 8 cm (3 in) long, plus 2 cm (1 in) tail (greater dog-like bat)<sup>[\\[6\\]](#cite_note-EmballonuridaeSize-6)</sup><br><br>*Habitats*: Caves, shrubland, and forest<sup>[\\[16\\]](#cite_note-PeropteryxHabitat-16)</sup> |
      | *[Rhynchonycteris](/wiki/Rhynchonycteris)* [![Brown bats](https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Long-nosed_proboscis_bats.JPG/250px-Long-nosed_proboscis_bats.JPG)](/wiki/File:Long-nosed_proboscis_bats.JPG) | [Peters](/wiki/Wilhelm_Peters), 1867 <br><br>hide One species <ul><li>*R. naso* ([Proboscis bat](/wiki/Proboscis_bat))</li></ul> | Mexico, Central America, and South America<br>[![Map of range](https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Proboscis_Bat_area.png/120px-Proboscis_Bat_area.png)](/wiki/File:Proboscis_Bat_area.png) | *Size*: 3–5 cm (1–2 in) long, plus 1–2 cm (0.4–0.8 in) tail<sup>[\\[6\\]](#cite_note-EmballonuridaeSize-6)</sup><br><br>*Habitats*: Forest and caves<sup>[\\[17\\]](#cite_note-IUCNProboscisbat-17)</sup> |
      | *[Saccopteryx](/wiki/Saccopteryx)*(sac-winged bat) [![Brown bats](https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Frosted_Sac-winged_Bat_imported_from_iNaturalist_photo_17543865_on_2_December_2024.jpg/250px-Frosted_Sac-winged_Bat_imported_from_iNaturalist_photo_17543865_on_2_December_2024.jpg)](/wiki/File:Frosted_Sac-winged_Bat_imported_from_iNaturalist_photo_17543865_on_2_December_2024.jpg) | [Illiger](/wiki/Johann_Karl_Wilhelm_Illiger), 1811 <br><br>hide Five species <ul><li>*S. antioquensis* ([Antioquian sac-winged bat](/wiki/Antioquian_sac-winged_bat))</li><li>*S. bilineata* ([Greater sac-winged bat](/wiki/Greater_sac-winged_bat))</li><li>*S. canescens* ([Frosted sac-winged bat](/wiki/Frosted_sac-winged_bat), pictured)</li><li>*S. gymnura* ([Amazonian sac-winged bat](/wiki/Amazonian_sac-winged_bat))</li><li>*S. leptura* ([Lesser sac-winged bat](/wiki/Lesser_sac-winged_bat))</li></ul> | Mexico, Central America, and South America | *Size range*: 3 cm (1 in) long, plus 1 cm (0.4 in) tail (Amazonian sac-winged bat) to 6 cm (2 in) long, plus 3 cm (1 in) tail (greater sac-winged bat)<sup>[\\[6\\]](#cite_note-EmballonuridaeSize-6)</sup><br><br>*Habitats*: Caves and forest<sup>[\\[18\\]](#cite_note-SaccopteryxHabitat-18)</sup> |"
    `)
  })
  it('breaking test', () => {
    const html = `<span class="vector-dropdown-label-text">Main menu</span>
\t</label>
\t<div class="vector-dropdown-content">


\t\t\t\t<div id="vector-main-menu-unpinned-container" class="vector-unpinned-container">
\t\t
<div id="vector-main-menu" class="vector-main-menu vector-pinnable-element">
\t<div
\tclass="vector-pinnable-header vector-main-menu-pinnable-header vector-pinnable-header-unpinned"
\tdata-feature-name="main-menu-pinned"
\tdata-pinnable-element-id="vector-main-menu"
\tdata-pinned-container-id="vector-main-menu-pinned-container"
\tdata-unpinned-container-id="vector-main-menu-unpinned-container"
>
\t<div class="vector-pinnable-header-label">Main menu</div>
\t<button class="vector-pinnable-header-toggle-button vector-pinnable-header-pin-button" data-event-name="pinnable-header.vector-main-menu.pin">move to sidebar</button>
\t<button class="vector-pinnable-header-toggle-button vector-pinnable-header-unpin-button" data-event-name="pinnable-header.vector-main-menu.unpin">hide</button>
</div>
`
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toMatchInlineSnapshot(`
      "Main menu

      Main menu

      move to sidebar



      hide"
    `)
  })
})
