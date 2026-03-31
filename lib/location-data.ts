// Hierarchical geo data: Country → District/Region → Cities
// Portugal and Spain have comprehensive coverage; other EU countries have main regions + cities.

export const GEO_DATA: Record<string, Record<string, string[]>> = {
  Portugal: {
    Aveiro: ['Aveiro', 'Águeda', 'Albergaria-a-Velha', 'Anadia', 'Arouca', 'Castelo de Paiva', 'Espinho', 'Estarreja', 'Ílhavo', 'Mealhada', 'Murtosa', 'Oliveira de Azeméis', 'Oliveira do Bairro', 'Ovar', 'Santa Maria da Feira', 'São João da Madeira', 'Sever do Vouga', 'Vagos', 'Vale de Cambra'],
    Beja: ['Beja', 'Aljustrel', 'Almodôvar', 'Alvito', 'Barrancos', 'Castro Verde', 'Cuba', 'Ferreira do Alentejo', 'Mértola', 'Moura', 'Odemira', 'Ourique', 'Serpa', 'Vidigueira'],
    Braga: ['Amares', 'Barcelos', 'Braga', 'Cabeceiras de Basto', 'Celorico de Basto', 'Esposende', 'Fafe', 'Guimarães', 'Póvoa de Lanhoso', 'Terras de Bouro', 'Vieira do Minho', 'Vila Nova de Famalicão', 'Vila Verde', 'Vizela'],
    Bragança: ['Alfândega da Fé', 'Bragança', 'Carrazeda de Ansiães', 'Freixo de Espada à Cinta', 'Macedo de Cavaleiros', 'Miranda do Douro', 'Mirandela', 'Mogadouro', 'Torre de Moncorvo', 'Vila Flor', 'Vimioso', 'Vinhais'],
    'Castelo Branco': ['Belmonte', 'Castelo Branco', 'Covilhã', 'Fundão', 'Idanha-a-Nova', 'Oleiros', 'Penamacor', 'Proença-a-Nova', 'Sertã', 'Vila de Rei', 'Vila Velha de Ródão'],
    Coimbra: ['Arganil', 'Cantanhede', 'Coimbra', 'Condeixa-a-Nova', 'Figueira da Foz', 'Góis', 'Lousã', 'Mira', 'Miranda do Corvo', 'Montemor-o-Velho', 'Mortágua', 'Oliveira do Hospital', 'Pampilhosa da Serra', 'Penacova', 'Penela', 'Soure', 'Tábua', 'Vila Nova de Poiares'],
    Évora: ['Alandroal', 'Arraiolos', 'Borba', 'Estremoz', 'Évora', 'Montemor-o-Novo', 'Mora', 'Mourão', 'Portel', 'Redondo', 'Reguengos de Monsaraz', 'Vendas Novas', 'Viana do Alentejo', 'Vila Viçosa'],
    Faro: ['Albufeira', 'Alcoutim', 'Aljezur', 'Castro Marim', 'Faro', 'Lagoa', 'Lagos', 'Loulé', 'Monchique', 'Olhão', 'Portimão', 'São Brás de Alportel', 'Silves', 'Tavira', 'Vila do Bispo', 'Vila Real de Santo António'],
    Guarda: ['Aguiar da Beira', 'Almeida', 'Celorico da Beira', 'Figueira de Castelo Rodrigo', 'Fornos de Algodres', 'Gouveia', 'Guarda', 'Manteigas', 'Mêda', 'Pinhel', 'Sabugal', 'Seia', 'Trancoso', 'Vila Nova de Foz Côa'],
    Leiria: ['Alcobaça', 'Alvaiázere', 'Ansião', 'Batalha', 'Bombarral', 'Caldas da Rainha', 'Castanheira de Pêra', 'Figueiró dos Vinhos', 'Leiria', 'Marinha Grande', 'Nazaré', 'Óbidos', 'Pedrógão Grande', 'Peniche', 'Pombal', 'Porto de Mós'],
    Lisboa: ['Alenquer', 'Amadora', 'Arruda dos Vinhos', 'Azambuja', 'Cadaval', 'Cascais', 'Lisboa', 'Loures', 'Lourinhã', 'Mafra', 'Odivelas', 'Oeiras', 'Sintra', 'Sobral de Monte Agraço', 'Torres Vedras', 'Vila Franca de Xira'],
    Portalegre: ['Alter do Chão', 'Arronches', 'Avis', 'Campo Maior', 'Castelo de Vide', 'Crato', 'Elvas', 'Fronteira', 'Gavião', 'Marvão', 'Monforte', 'Nisa', 'Ponte de Sor', 'Portalegre', 'Sousel'],
    Porto: ['Amarante', 'Baião', 'Felgueiras', 'Gondomar', 'Lousada', 'Maia', 'Marco de Canaveses', 'Matosinhos', 'Paços de Ferreira', 'Paredes', 'Penafiel', 'Porto', 'Póvoa de Varzim', 'Santo Tirso', 'Trofa', 'Valongo', 'Vila do Conde', 'Vila Nova de Gaia'],
    Santarém: ['Abrantes', 'Alcanena', 'Almeirim', 'Alpiarça', 'Benavente', 'Cartaxo', 'Chamusca', 'Constância', 'Coruche', 'Entroncamento', 'Ferreira do Zêzere', 'Golegã', 'Mação', 'Ourém', 'Rio Maior', 'Salvaterra de Magos', 'Santarém', 'Tomar', 'Torres Novas', 'Vila Nova da Barquinha'],
    Setúbal: ['Alcácer do Sal', 'Alcochete', 'Almada', 'Barreiro', 'Grândola', 'Moita', 'Montijo', 'Palmela', 'Santiago do Cacém', 'Seixal', 'Sesimbra', 'Setúbal', 'Sines'],
    'Viana do Castelo': ['Arcos de Valdevez', 'Caminha', 'Melgaço', 'Monção', 'Paredes de Coura', 'Ponte da Barca', 'Ponte de Lima', 'Valença', 'Viana do Castelo', 'Vila Nova de Cerveira'],
    'Vila Real': ['Alijó', 'Boticas', 'Chaves', 'Mesão Frio', 'Mondim de Basto', 'Montalegre', 'Murça', 'Peso da Régua', 'Ribeira de Pena', 'Sabrosa', 'Santa Marta de Penaguião', 'Valpaços', 'Vila Pouca de Aguiar', 'Vila Real'],
    Viseu: ['Armamar', 'Carregal do Sal', 'Castro Daire', 'Cinfães', 'Lamego', 'Mangualde', 'Moimenta da Beira', 'Mortágua', 'Nelas', 'Oliveira de Frades', 'Penalva do Castelo', 'Penedono', 'Resende', 'Santa Comba Dão', 'São João da Pesqueira', 'São Pedro do Sul', 'Sátão', 'Sernancelhe', 'Tabuaço', 'Tarouca', 'Tondela', 'Vila Nova de Paiva', 'Viseu', 'Vouzela'],
    Açores: ['Angra do Heroísmo', 'Horta', 'Lagoa', 'Lajes das Flores', 'Lajes do Pico', 'Madalena', 'Nordeste', 'Ponta Delgada', 'Povoação', 'Praia da Vitória', 'Ribeira Grande', 'Santa Cruz da Graciosa', 'Santa Cruz das Flores', 'São Roque do Pico', 'Velas', 'Vila do Porto', 'Vila Franca do Campo'],
    Madeira: ['Calheta', 'Câmara de Lobos', 'Funchal', 'Machico', 'Ponta do Sol', 'Porto Moniz', 'Porto Santo', 'Ribeira Brava', 'Santa Cruz', 'Santana', 'São Vicente'],
  },

  Spain: {
    Andalucía: ['Almería', 'Cádiz', 'Córdoba', 'Granada', 'Huelva', 'Jaén', 'Jerez de la Frontera', 'Málaga', 'Marbella', 'Sevilla'],
    Aragón: ['Huesca', 'Teruel', 'Zaragoza'],
    Asturias: ['Avilés', 'Gijón', 'Oviedo', 'Siero'],
    'Islas Baleares': ['Eivissa', 'Maó', 'Palma', 'Calviá'],
    Canarias: ['Arrecife', 'Las Palmas de Gran Canaria', 'Puerto del Rosario', 'San Cristóbal de La Laguna', 'Santa Cruz de Tenerife'],
    Cantabria: ['Castro Urdiales', 'Santander', 'Torrelavega'],
    'Castilla-La Mancha': ['Albacete', 'Ciudad Real', 'Cuenca', 'Guadalajara', 'Toledo'],
    'Castilla y León': ['Ávila', 'Burgos', 'León', 'Palencia', 'Salamanca', 'Segovia', 'Soria', 'Valladolid', 'Zamora'],
    Cataluña: ['Badalona', 'Barcelona', 'Girona', 'Hospitalet de Llobregat', 'Lleida', 'Tarragona', 'Terrassa'],
    Extremadura: ['Badajoz', 'Cáceres', 'Mérida', 'Plasencia'],
    Galicia: ['A Coruña', 'Ferrol', 'Lugo', 'Ourense', 'Pontevedra', 'Santiago de Compostela', 'Vigo'],
    'La Rioja': ['Calahorra', 'Logroño'],
    Madrid: ['Alcalá de Henares', 'Alcorcón', 'Fuenlabrada', 'Getafe', 'Leganés', 'Madrid', 'Móstoles', 'Torrejón de Ardoz'],
    Murcia: ['Cartagena', 'Lorca', 'Murcia'],
    Navarra: ['Pamplona', 'Tudela', 'Barañáin'],
    'País Vasco': ['Barakaldo', 'Bilbao', 'Donostia-San Sebastián', 'Vitoria-Gasteiz'],
    'Comunidad Valenciana': ['Alicante', 'Castellón de la Plana', 'Elche', 'Torrevieja', 'Valencia'],
    Ceuta: ['Ceuta'],
    Melilla: ['Melilla'],
  },

  Albania: {
    Berat: ['Berat', 'Çorovodë', 'Ura Vajgurore'],
    Durrës: ['Durrës', 'Shijak', 'Krujë'],
    Elbasan: ['Elbasan', 'Cërrik', 'Librazhd'],
    Fier: ['Fier', 'Lushnjë', 'Patos'],
    Gjirokastër: ['Gjirokastër', 'Tepelenë', 'Përmet'],
    Korçë: ['Korçë', 'Pogradec', 'Devoll'],
    Kukës: ['Kukës', 'Has', 'Tropojë'],
    Lezhë: ['Lezhë', 'Mirditë', 'Kurbin'],
    Shkodër: ['Shkodër', 'Pukë', 'Malësi e Madhe'],
    Tirana: ['Tirana', 'Kamëz', 'Vorë'],
    Vlorë: ['Vlorë', 'Sarandë', 'Himarë'],
  },

  Andorra: {
    Andorra: ['Andorra la Vella', 'Escaldes-Engordany', 'Encamp', 'Sant Julià de Lòria', 'La Massana'],
  },

  Austria: {
    Vienna: ['Vienna'],
    'Lower Austria': ['St. Pölten', 'Krems an der Donau', 'Wiener Neustadt', 'Klosterneuburg'],
    'Upper Austria': ['Linz', 'Wels', 'Steyr', 'Leonding', 'Traun'],
    Styria: ['Graz', 'Leoben', 'Kapfenberg', 'Bruck an der Mur'],
    Tyrol: ['Innsbruck', 'Kufstein', 'Wörgl', 'Hall in Tirol'],
    Salzburg: ['Salzburg', 'Hallein', 'Wals-Siezenheim', 'Saalfelden'],
    Carinthia: ['Klagenfurt', 'Villach', 'Wolfsberg', 'Feldkirchen'],
    Vorarlberg: ['Bregenz', 'Dornbirn', 'Feldkirch', 'Lustenau'],
    Burgenland: ['Eisenstadt', 'Neusiedl am See', 'Oberwart', 'Mattersburg'],
  },

  Belgium: {
    Brussels: ['Brussels', 'Anderlecht', 'Molenbeek-Saint-Jean', 'Schaerbeek'],
    Flanders: ['Antwerp', 'Ghent', 'Bruges', 'Leuven', 'Mechelen', 'Hasselt', 'Kortrijk', 'Genk'],
    Wallonia: ['Liège', 'Charleroi', 'Namur', 'Mons', 'La Louvière', 'Tournai'],
  },

  'Bosnia and Herzegovina': {
    Federation: ['Sarajevo', 'Mostar', 'Tuzla', 'Zenica', 'Bihać'],
    'Republika Srpska': ['Banja Luka', 'Bijeljina', 'Doboj', 'Prijedor'],
  },

  Bulgaria: {
    Sofia: ['Sofia', 'Pernik', 'Botevgrad'],
    Plovdiv: ['Plovdiv', 'Asenovgrad', 'Karlovo'],
    Varna: ['Varna', 'Devnya', 'Provadia'],
    Burgas: ['Burgas', 'Nesebar', 'Pomorie'],
    'Stara Zagora': ['Stara Zagora', 'Kazanlak', 'Chirpan'],
    'Veliko Tarnovo': ['Veliko Tarnovo', 'Gorna Oryahovitsa', 'Svishtov'],
    Ruse: ['Ruse', 'Byala', 'Borovo'],
    Pleven: ['Pleven', 'Levski', 'Nikopol'],
  },

  Croatia: {
    Zagreb: ['Zagreb', 'Velika Gorica', 'Zaprešić', 'Samobor'],
    Split: ['Split', 'Solin', 'Kaštela', 'Trogir'],
    Rijeka: ['Rijeka', 'Opatija', 'Kastav', 'Bakar'],
    Osijek: ['Osijek', 'Vinkovci', 'Vukovar', 'Slavonski Brod'],
    Zadar: ['Zadar', 'Biograd na Moru', 'Benkovac'],
    Dubrovnik: ['Dubrovnik', 'Metković', 'Korčula'],
    Pula: ['Pula', 'Rovinj', 'Poreč', 'Umag'],
  },

  Cyprus: {
    Nicosia: ['Nicosia', 'Strovolos', 'Aglantzía'],
    Limassol: ['Limassol', 'Mesa Geitonia', 'Agios Athanasios'],
    Larnaca: ['Larnaca', 'Aradippou', 'Livadia'],
    Paphos: ['Paphos', 'Geroskipou', 'Chlorakas'],
    Famagusta: ['Paralimni', 'Deryneia', 'Sotira'],
    Kyrenia: ['Kyrenia', 'Lapithos', 'Karavas'],
  },

  'Czech Republic': {
    'Prague': ['Prague'],
    'Central Bohemia': ['Kladno', 'Mladá Boleslav', 'Příbram', 'Beroun'],
    'South Bohemia': ['České Budějovice', 'Písek', 'Tábor', 'Jindřichův Hradec'],
    Plzeň: ['Plzeň', 'Rokycany', 'Klatovy'],
    'Karlovy Vary': ['Karlovy Vary', 'Sokolov', 'Cheb'],
    'Ústí nad Labem': ['Ústí nad Labem', 'Most', 'Chomutov', 'Děčín'],
    Liberec: ['Liberec', 'Jablonec nad Nisou'],
    'Hradec Králové': ['Hradec Králové', 'Jičín', 'Náchod'],
    Pardubice: ['Pardubice', 'Chrudim', 'Svitavy'],
    Vysočina: ['Jihlava', 'Třebíč', 'Havlíčkův Brod'],
    'South Moravia': ['Brno', 'Znojmo', 'Hodonín', 'Břeclav'],
    Olomouc: ['Olomouc', 'Prostějov', 'Přerov', 'Šumperk'],
    Zlín: ['Zlín', 'Uherské Hradiště', 'Vsetín'],
    'Moravian-Silesian': ['Ostrava', 'Opava', 'Frýdek-Místek', 'Karviná'],
  },

  Denmark: {
    'Capital Region': ['Copenhagen', 'Frederiksberg', 'Helsingør', 'Hillerød'],
    Zealand: ['Roskilde', 'Næstved', 'Holbæk', 'Slagelse'],
    'Southern Denmark': ['Odense', 'Esbjerg', 'Kolding', 'Vejle', 'Horsens'],
    'Central Jutland': ['Aarhus', 'Viborg', 'Herning', 'Silkeborg', 'Randers'],
    'North Jutland': ['Aalborg', 'Frederikshavn', 'Hjørring'],
  },

  Estonia: {
    Harju: ['Tallinn', 'Saue', 'Maardu', 'Keila'],
    Tartu: ['Tartu', 'Elva', 'Võru'],
    'Ida-Viru': ['Narva', 'Kohtla-Järve', 'Jõhvi'],
    Pärnu: ['Pärnu', 'Vändra', 'Tori'],
    Lääne: ['Haapsalu', 'Lääneranna', 'Noarootsi'],
  },

  Finland: {
    Uusimaa: ['Helsinki', 'Espoo', 'Vantaa', 'Tampere', 'Lahti', 'Porvoo'],
    'Southwest Finland': ['Turku', 'Salo', 'Loimaa', 'Raisio'],
    Pirkanmaa: ['Tampere', 'Nokia', 'Ylöjärvi', 'Kangasala'],
    'Central Finland': ['Jyväskylä', 'Jämsä', 'Äänekoski'],
    'North Ostrobothnia': ['Oulu', 'Raahe', 'Kajaani'],
    Lapland: ['Rovaniemi', 'Kemi', 'Tornio'],
  },

  France: {
    'Île-de-France': ['Paris', 'Boulogne-Billancourt', 'Saint-Denis', 'Versailles', 'Nanterre', 'Créteil'],
    'Auvergne-Rhône-Alpes': ['Lyon', 'Grenoble', 'Clermont-Ferrand', 'Saint-Étienne', 'Annecy'],
    'Provence-Alpes-Côte d\'Azur': ['Marseille', 'Nice', 'Toulon', 'Aix-en-Provence', 'Avignon'],
    'Nouvelle-Aquitaine': ['Bordeaux', 'Limoges', 'Poitiers', 'Pau', 'Bayonne'],
    Occitanie: ['Toulouse', 'Montpellier', 'Nîmes', 'Perpignan'],
    'Hauts-de-France': ['Lille', 'Amiens', 'Roubaix', 'Tourcoing', 'Valenciennes'],
    'Grand Est': ['Strasbourg', 'Mulhouse', 'Reims', 'Metz', 'Nancy'],
    Normandie: ['Rouen', 'Caen', 'Le Havre', 'Cherbourg-en-Cotentin'],
    Bretagne: ['Rennes', 'Brest', 'Quimper', 'Lorient'],
    'Pays de la Loire': ['Nantes', 'Le Mans', 'Angers', 'Saint-Nazaire'],
    'Centre-Val de Loire': ['Tours', 'Orléans', 'Blois', 'Chartres'],
    Bourgogne: ['Dijon', 'Besançon', 'Chalon-sur-Saône'],
    Corse: ['Ajaccio', 'Bastia'],
  },

  Germany: {
    'Baden-Württemberg': ['Stuttgart', 'Karlsruhe', 'Mannheim', 'Freiburg', 'Heidelberg', 'Ulm'],
    Bavaria: ['Munich', 'Nuremberg', 'Augsburg', 'Regensburg', 'Würzburg', 'Ingolstadt'],
    Berlin: ['Berlin'],
    Brandenburg: ['Potsdam', 'Cottbus', 'Brandenburg an der Havel'],
    Bremen: ['Bremen', 'Bremerhaven'],
    Hamburg: ['Hamburg'],
    Hesse: ['Frankfurt', 'Wiesbaden', 'Darmstadt', 'Kassel', 'Offenbach'],
    'Mecklenburg-Vorpommern': ['Rostock', 'Schwerin', 'Greifswald'],
    'Lower Saxony': ['Hanover', 'Braunschweig', 'Osnabrück', 'Wolfsburg', 'Göttingen'],
    'North Rhine-Westphalia': ['Cologne', 'Düsseldorf', 'Dortmund', 'Essen', 'Duisburg', 'Bochum', 'Bonn', 'Münster'],
    'Rhineland-Palatinate': ['Mainz', 'Koblenz', 'Trier', 'Kaiserslautern', 'Ludwigshafen'],
    Saarland: ['Saarbrücken', 'Neunkirchen', 'Homburg'],
    Saxony: ['Dresden', 'Leipzig', 'Chemnitz', 'Zwickau'],
    'Saxony-Anhalt': ['Halle', 'Magdeburg', 'Dessau-Roßlau'],
    'Schleswig-Holstein': ['Kiel', 'Lübeck', 'Flensburg'],
    Thuringia: ['Erfurt', 'Gera', 'Jena', 'Weimar'],
  },

  Greece: {
    Attica: ['Athens', 'Piraeus', 'Peristeri', 'Kallithea', 'Nikaia'],
    'Central Macedonia': ['Thessaloniki', 'Kalamaria', 'Serres', 'Veria'],
    'Western Greece': ['Patras', 'Agrinio', 'Ioannina'],
    Crete: ['Heraklion', 'Chania', 'Rethymno', 'Agios Nikolaos'],
    Peloponnese: ['Kalamata', 'Tripoli', 'Corinth', 'Sparta'],
    'Aegean Islands': ['Rhodes', 'Kos', 'Chios', 'Lesbos'],
    'Ionian Islands': ['Corfu', 'Kefalonia', 'Zakynthos'],
  },

  Hungary: {
    Budapest: ['Budapest', 'Újpest', 'Kispest'],
    'Pest County': ['Gödöllő', 'Érd', 'Vác', 'Monor'],
    'Győr-Moson-Sopron': ['Győr', 'Sopron', 'Mosonmagyaróvár'],
    'Borsod-Abaúj-Zemplén': ['Miskolc', 'Kazincbarcika', 'Ózd'],
    'Hajdú-Bihar': ['Debrecen', 'Hajdúböszörmény', 'Berettyóújfalu'],
    'Csongrád-Csanád': ['Szeged', 'Hódmezővásárhely', 'Makó'],
    Baranya: ['Pécs', 'Komló', 'Mohács'],
    'Veszprém': ['Veszprém', 'Ajka', 'Pápa'],
  },

  Iceland: {
    'Capital Region': ['Reykjavik', 'Kópavogur', 'Hafnarfjörður', 'Akranes'],
    'Southern Peninsula': ['Selfoss', 'Vestmannaeyjar'],
    West: ['Borgarnes', 'Ísafjörður', 'Akureyri'],
    'East Iceland': ['Egilsstaðir', 'Seyðisfjörður'],
  },

  Ireland: {
    Leinster: ['Dublin', 'Limerick', 'Drogheda', 'Dundalk', 'Wicklow', 'Kilkenny', 'Wexford'],
    Munster: ['Cork', 'Limerick', 'Waterford', 'Tralee', 'Killarney', 'Ennis'],
    Connacht: ['Galway', 'Sligo', 'Castlebar', 'Roscommon', 'Athlone'],
    Ulster: ['Donegal', 'Monaghan', 'Cavan', 'Letterkenny'],
  },

  Italy: {
    Lombardy: ['Milan', 'Brescia', 'Bergamo', 'Monza', 'Como', 'Varese', 'Pavia'],
    Lazio: ['Rome', 'Latina', 'Frosinone', 'Viterbo', 'Rieti'],
    Campania: ['Naples', 'Salerno', 'Caserta', 'Bari', 'Torre del Greco'],
    Sicily: ['Palermo', 'Catania', 'Messina', 'Syracuse', 'Trapani'],
    Veneto: ['Venice', 'Verona', 'Padua', 'Vicenza', 'Treviso'],
    Piedmont: ['Turin', 'Novara', 'Alessandria', 'Asti', 'Cuneo'],
    Emilia: ['Bologna', 'Modena', 'Parma', 'Reggio Emilia', 'Ferrara', 'Rimini', 'Ravenna'],
    Tuscany: ['Florence', 'Prato', 'Livorno', 'Pisa', 'Siena', 'Arezzo', 'Lucca'],
    Puglia: ['Bari', 'Taranto', 'Foggia', 'Brindisi', 'Lecce'],
    Calabria: ['Reggio Calabria', 'Catanzaro', 'Cosenza'],
    Sardinia: ['Cagliari', 'Sassari', 'Nuoro', 'Olbia'],
    'Trentino-Alto Adige': ['Trento', 'Bolzano', 'Rovereto', 'Merano'],
    Liguria: ['Genoa', 'La Spezia', 'Savona', 'Imperia'],
    Umbria: ['Perugia', 'Terni', 'Foligno', 'Spoleto'],
    'Friuli-Venezia Giulia': ['Trieste', 'Udine', 'Pordenone', 'Gorizia'],
    Marche: ['Ancona', 'Pesaro', 'Macerata', 'Fano'],
    Abruzzo: ["L'Aquila", 'Pescara', 'Chieti', 'Teramo'],
    Basilicata: ['Potenza', 'Matera'],
    Molise: ['Campobasso', 'Isernia'],
    'Valle d\'Aosta': ["Aosta"],
  },

  Kosovo: {
    Pristina: ['Pristina', 'Podujevo', 'Gjilan'],
    Prizren: ['Prizren', 'Dragash'],
    Ferizaj: ['Ferizaj', 'Shtime'],
    Peja: ['Peja', 'Istog', 'Klina'],
    Mitrovica: ['Mitrovica', 'Vushtrri', 'Skënderaj'],
  },

  Latvia: {
    Riga: ['Riga', 'Jūrmala', 'Salaspils'],
    Vidzeme: ['Valmiera', 'Sigulda', 'Cēsis', 'Limbaži'],
    Kurzeme: ['Ventspils', 'Liepāja', 'Kuldīga'],
    Zemgale: ['Jelgava', 'Dobele', 'Bauska'],
    Latgale: ['Daugavpils', 'Rēzekne', 'Ludza'],
  },

  Liechtenstein: {
    Liechtenstein: ['Vaduz', 'Schaan', 'Balzers', 'Triesen'],
  },

  Lithuania: {
    Vilnius: ['Vilnius', 'Šalčininkai', 'Vilnius District'],
    Kaunas: ['Kaunas', 'Jonava', 'Kėdainiai'],
    Klaipėda: ['Klaipėda', 'Palanga', 'Neringa'],
    Šiauliai: ['Šiauliai', 'Radviliškis', 'Kelmė'],
    Panevėžys: ['Panevėžys', 'Biržai', 'Rokiškis'],
    Alytus: ['Alytus', 'Lazdijai', 'Varėna'],
    Marijampolė: ['Marijampolė', 'Šakiai', 'Vilkaviškis'],
  },

  Luxembourg: {
    'Luxembourg City': ['Luxembourg City', 'Hesperange', 'Niederanven'],
    Esch: ['Esch-sur-Alzette', 'Differdange', 'Schifflange'],
    Diekirch: ['Diekirch', 'Ettelbrück', 'Wiltz'],
    Grevenmacher: ['Grevenmacher', 'Remich', 'Echternach'],
  },

  Malta: {
    'Northern Malta': ['Valletta', 'Mdina', 'Rabat', 'Mosta', 'Naxxar'],
    'Southern Malta': ['Marsaxlokk', 'Birżebbuġa', 'Żurrieq'],
    Gozo: ['Victoria', 'Nadur', 'Xagħra'],
  },

  Moldova: {
    Chișinău: ['Chișinău', 'Cricova', 'Codru'],
    Bălți: ['Bălți', 'Glodeni', 'Sângerei'],
    Cahul: ['Cahul', 'Vulcănești'],
    Soroca: ['Soroca', 'Florești', 'Dondușeni'],
    Orhei: ['Orhei', 'Rezina', 'Șoldănești'],
  },

  Monaco: {
    Monaco: ['Monaco', 'Monte Carlo', 'La Condamine'],
  },

  Montenegro: {
    Podgorica: ['Podgorica', 'Danilovgrad', 'Kolašin'],
    'Coastal Region': ['Bar', 'Budva', 'Kotor', 'Herceg Novi', 'Tivat'],
    North: ['Bijelo Polje', 'Berane', 'Nikšić'],
  },

  Netherlands: {
    'North Holland': ['Amsterdam', 'Haarlem', 'Alkmaar', 'Zaandam'],
    'South Holland': ['Rotterdam', 'The Hague', 'Leiden', 'Dordrecht', 'Delft'],
    Utrecht: ['Utrecht', 'Amersfoort', 'Nieuwegein', 'Zeist'],
    Zeeland: ['Middelburg', 'Goes', 'Vlissingen'],
    'North Brabant': ['Eindhoven', 'Tilburg', 'Breda', 'Hertogenbosch', 'Helmond'],
    Limburg: ['Maastricht', 'Venlo', 'Heerlen', 'Roermond'],
    Gelderland: ['Arnhem', 'Nijmegen', 'Apeldoorn', 'Ede'],
    Overijssel: ['Enschede', 'Zwolle', 'Deventer', 'Hengelo'],
    Groningen: ['Groningen', 'Emmen', 'Hoogeveen'],
    Friesland: ['Leeuwarden', 'Sneek', 'Dokkum'],
    Drenthe: ['Assen', 'Emmen', 'Meppel'],
    Flevoland: ['Almere', 'Lelystad'],
  },

  'North Macedonia': {
    Skopje: ['Skopje', 'Aerodrom', 'Gazi Baba'],
    Bitola: ['Bitola', 'Resen', 'Demir Hisar'],
    Kumanovo: ['Kumanovo', 'Kratovo', 'Staro Nagoričane'],
    Tetovo: ['Tetovo', 'Gostivar', 'Brvenica'],
    Veles: ['Veles', 'Negotino', 'Kavadarci'],
  },

  Norway: {
    'Oslo': ['Oslo', 'Bærum', 'Lørenskog'],
    'Viken': ['Drammen', 'Fredrikstad', 'Sarpsborg', 'Lillestrøm'],
    Innlandet: ['Hamar', 'Lillehammer', 'Gjøvik'],
    Vestland: ['Bergen', 'Sogndal', 'Florø'],
    Rogaland: ['Stavanger', 'Sandnes', 'Haugesund'],
    'Møre og Romsdal': ['Ålesund', 'Molde', 'Kristiansund'],
    Trøndelag: ['Trondheim', 'Steinkjer', 'Namsos'],
    Nordland: ['Bodø', 'Narvik', 'Mo i Rana'],
    Troms: ['Tromsø', 'Harstad', 'Lenvik'],
    Finnmark: ['Alta', 'Hammerfest', 'Vadsø'],
  },

  Poland: {
    Masovian: ['Warsaw', 'Płock', 'Siedlce', 'Radom'],
    Lesser: ['Kraków', 'Tarnów', 'Nowy Sącz', 'Oświęcim'],
    Silesian: ['Katowice', 'Częstochowa', 'Sosnowiec', 'Gliwice', 'Zabrze', 'Bytom', 'Bielsko-Biała'],
    Greater: ['Poznań', 'Kalisz', 'Konin', 'Gniezno'],
    'Lower Silesian': ['Wrocław', 'Legnica', 'Wałbrzych', 'Jelenia Góra'],
    Łódź: ['Łódź', 'Piotrków Trybunalski', 'Tomaszów Mazowiecki'],
    Pomeranian: ['Gdańsk', 'Gdynia', 'Sopot', 'Słupsk'],
    'Kuyavian-Pomeranian': ['Bydgoszcz', 'Toruń', 'Włocławek'],
    Lublin: ['Lublin', 'Zamość', 'Chełm', 'Biała Podlaska'],
    Subcarpathian: ['Rzeszów', 'Przemyśl', 'Stalowa Wola', 'Tarnobrzeg'],
    Opole: ['Opole', 'Kędzierzyn-Koźle', 'Nysa'],
    'Warmian-Masurian': ['Olsztyn', 'Elbląg', 'Ełk'],
    'West Pomeranian': ['Szczecin', 'Koszalin', 'Stargard'],
    'Holy Cross': ['Kielce', 'Ostrowiec Świętokrzyski', 'Starachowice'],
    Podlachian: ['Białystok', 'Łomża', 'Suwałki'],
    Lubusz: ['Zielona Góra', 'Gorzów Wielkopolski'],
  },

  Romania: {
    Bucharest: ['Bucharest', 'Sector 1', 'Sector 2', 'Sector 3', 'Sector 4', 'Sector 5', 'Sector 6'],
    Cluj: ['Cluj-Napoca', 'Dej', 'Câmpia Turzii', 'Turda'],
    Timiș: ['Timișoara', 'Lugoj', 'Deta'],
    Iași: ['Iași', 'Pașcani', 'Hârlău'],
    Constanța: ['Constanța', 'Mangalia', 'Medgidia'],
    Brașov: ['Brașov', 'Codlea', 'Săcele', 'Râșnov', 'Zărnești'],
    Prahova: ['Ploiești', 'Câmpina', 'Sinaia', 'Vălenii de Munte'],
    Dolj: ['Craiova', 'Calafat', 'Băilești'],
    Mureș: ['Târgu Mureș', 'Reghin', 'Sighișoara'],
    Sibiu: ['Sibiu', 'Mediaș', 'Cisnădie'],
  },

  'San Marino': {
    'San Marino': ['San Marino', 'Serravalle', 'Borgo Maggiore'],
  },

  Serbia: {
    Belgrade: ['Belgrade', 'Zemun', 'Novi Beograd', 'Pančevo'],
    'South Bačka': ['Novi Sad', 'Sremska Mitrovica', 'Vrbas'],
    Nišava: ['Niš', 'Leskovac', 'Prokuplje'],
    Šumadija: ['Kragujevac', 'Aranđelovac', 'Topola'],
    Zlatibor: ['Užice', 'Čačak', 'Nova Varoš'],
  },

  Slovakia: {
    Bratislava: ['Bratislava', 'Malacky', 'Pezinok'],
    Trnava: ['Trnava', 'Hlohovec', 'Piešťany'],
    Trenčín: ['Trenčín', 'Dubnica nad Váhom', 'Považská Bystrica'],
    Nitra: ['Nitra', 'Komárno', 'Nové Zámky'],
    Žilina: ['Žilina', 'Martin', 'Čadca'],
    'Banská Bystrica': ['Banská Bystrica', 'Zvolen', 'Lučenec'],
    Prešov: ['Prešov', 'Poprad', 'Michalovce'],
    Košice: ['Košice', 'Spišská Nová Ves', 'Rožňava'],
  },

  Slovenia: {
    Ljubljana: ['Ljubljana', 'Kranj', 'Jesenice', 'Kamnik'],
    Maribor: ['Maribor', 'Ptuj', 'Murska Sobota'],
    Celje: ['Celje', 'Velenje', 'Slovenj Gradec'],
    Koper: ['Koper', 'Piran', 'Izola'],
    'Nova Gorica': ['Nova Gorica', 'Ajdovščina', 'Tolmin'],
    'Novo Mesto': ['Novo Mesto', 'Kočevje', 'Trebnje'],
  },

  Sweden: {
    Stockholm: ['Stockholm', 'Solna', 'Sundbyberg', 'Huddinge', 'Järfälla', 'Täby'],
    'Västra Götaland': ['Gothenburg', 'Borås', 'Mölndal', 'Trollhättan', 'Lidköping'],
    Skåne: ['Malmö', 'Helsingborg', 'Lund', 'Kristianstad'],
    Uppsala: ['Uppsala', 'Enköping', 'Tierp'],
    Östergötland: ['Linköping', 'Norrköping', 'Motala'],
    Jönköping: ['Jönköping', 'Huskvarna', 'Vetlanda'],
    'Värmland': ['Karlstad', 'Kristinehamn', 'Säffle'],
    Örebro: ['Örebro', 'Kumla', 'Lindesberg'],
    Dalarna: ['Falun', 'Borlänge', 'Ludvika'],
    Norrbotten: ['Luleå', 'Kiruna', 'Piteå'],
    Västernorrland: ['Sundsvall', 'Härnösand', 'Kramfors'],
  },

  Switzerland: {
    'Zurich': ['Zurich', 'Winterthur', 'Uster', 'Kloten'],
    Bern: ['Bern', 'Biel/Bienne', 'Thun', 'Köniz'],
    Vaud: ['Lausanne', 'Renens', 'Montreux', 'Nyon', 'Yverdon-les-Bains'],
    Geneva: ['Geneva', 'Carouge', 'Lancy', 'Vernier'],
    Basel: ['Basel', 'Binningen', 'Allschwil', 'Riehen'],
    Aargau: ['Aarau', 'Baden', 'Wettingen'],
    'St. Gallen': ['St. Gallen', 'Rapperswil-Jona', 'Wil'],
    Lucerne: ['Lucerne', 'Sursee', 'Emmen'],
    Ticino: ['Lugano', 'Bellinzona', 'Locarno', 'Mendrisio'],
    Valais: ['Sion', 'Monthey', 'Martigny', 'Sierre'],
    Graubünden: ['Chur', 'Davos', 'St. Moritz'],
    Fribourg: ['Fribourg', 'Bulle', 'Murten'],
    Solothurn: ['Solothurn', 'Olten', 'Grenchen'],
    Neuchâtel: ['Neuchâtel', 'La Chaux-de-Fonds', 'Le Locle'],
  },

  Turkey: {
    Istanbul: ['Istanbul', 'Kadıköy', 'Üsküdar', 'Fatih', 'Beşiktaş'],
    Edirne: ['Edirne', 'Uzunköprü', 'Keşan'],
    Tekirdağ: ['Tekirdağ', 'Çorlu', 'Çerkezköy'],
    Kırklareli: ['Kırklareli', 'Lüleburgaz', 'Babaeski'],
  },

  Ukraine: {
    Kyiv: ['Kyiv', 'Bila Tserkva', 'Boryspil'],
    Kharkiv: ['Kharkiv', 'Lozova', 'Izyum'],
    Odessa: ['Odessa', 'Mykolaiv', 'Kherson'],
    Lviv: ['Lviv', 'Drohobych', 'Stryi', 'Truskavets'],
    Dnipro: ['Dnipro', 'Kryvyi Rih', 'Kamianske', 'Nikopol'],
    Donetsk: ['Kramatorsk', 'Mariupol', 'Sloviansk'],
    Zaporizhzhia: ['Zaporizhzhia', 'Melitopol', 'Berdiansk'],
    Vinnytsia: ['Vinnytsia', 'Zhmerynka', 'Mohyliv-Podilskyi'],
    Poltava: ['Poltava', 'Kremenchuk', 'Myrhorod'],
  },

  'United Kingdom': {
    England: ['London', 'Birmingham', 'Manchester', 'Leeds', 'Sheffield', 'Liverpool', 'Bristol', 'Coventry', 'Leicester', 'Nottingham', 'Newcastle', 'Brighton', 'Southampton', 'Oxford', 'Cambridge'],
    Scotland: ['Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee', 'Inverness', 'Perth', 'Stirling'],
    Wales: ['Cardiff', 'Swansea', 'Newport', 'Wrexham', 'Bangor'],
    'Northern Ireland': ['Belfast', 'Derry', 'Lisburn', 'Newtownabbey', 'Newry'],
  },
}

// Ordered country list: Portugal first, Spain second, then alphabetical
const firstCountries = ['Portugal', 'Spain']
export const COUNTRIES: string[] = [
  ...firstCountries,
  ...Object.keys(GEO_DATA)
    .filter((c) => !firstCountries.includes(c))
    .sort(),
]

export function getDistricts(country: string): string[] {
  return Object.keys(GEO_DATA[country] || {}).sort((a, b) => {
    // Keep Portugal and Spain districts in natural geographic order
    const data = GEO_DATA[country]
    if (!data) return 0
    const keys = Object.keys(data)
    return keys.indexOf(a) - keys.indexOf(b)
  })
}

export function getCities(country: string, district: string): string[] {
  return GEO_DATA[country]?.[district] ?? []
}

/** Given a city name, returns the district it belongs to for that country (case-insensitive). */
export function getDistrictByCity(country: string, city: string): string | null {
  const countryData = GEO_DATA[country]
  if (!countryData) return null
  const normalized = city.trim().toLowerCase()
  for (const [district, cities] of Object.entries(countryData)) {
    if (cities.some(c => c.toLowerCase() === normalized)) return district
  }
  return null
}
