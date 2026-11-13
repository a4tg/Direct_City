-- Approved by the user: real map quarters; building IDs and all personal progress remain.
ALTER TABLE buildings DROP CONSTRAINT buildings_district_id_position_key;
UPDATE buildings b SET district_id=v.district,position=v.position
FROM (VALUES
('building-meiku-neko','district-1',0),
('building-petpower','district-1',1),
('building-toutes-peaux','district-1',2),
('building-koyo','district-1',3),
('building-klimych','district-2',0),
('building-walnut','district-2',1),
('building-ouborka','district-2',2),
('building-generalim','district-2',3),
('building-hobbylab','district-3',0),
('building-paw-factory','district-3',1),
('building-mymania','district-3',2),
('building-nuzhnoe','district-3',3),
('building-pole-yagoda','district-4',0),
('building-multizavrik','district-4',1),
('building-yesmix','district-4',2),
('building-rastvor','district-4',3)
) AS v(id,district,position) WHERE b.id=v.id;
ALTER TABLE buildings ADD CONSTRAINT buildings_district_id_position_key UNIQUE(district_id,position);
DELETE FROM unlocked_districts;
INSERT INTO unlocked_districts(user_id,district_id)
 SELECT DISTINCT ub.user_id,b.district_id FROM unlocked_buildings ub JOIN buildings b ON b.id=ub.building_id;
